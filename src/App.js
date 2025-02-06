import React, { useState, useEffect } from "react";
import { database } from "./firebase";
import { getDatabase, ref, set, remove, onValue, onDisconnect } from "firebase/database";
import './App.css'; // 確保這一行存在

const NUM_LAYERS = 10; // 總共有 10 層

function App() {
  const [teamCode, setTeamCode] = useState(""); // 房間 ID
  const [playerName, setPlayerName] = useState(""); // 玩家暱稱
  const [data, setData] = useState({}); // 遊戲數據
  const [players, setPlayers] = useState({}); // 玩家列表
  const [currentLayer, setCurrentLayer] = useState(0); // 當前層數
  const [joined, setJoined] = useState(false); // 是否加入遊戲
  const [isComplete, setIsComplete] = useState(false); // 是否完成第 10 層

  const gameRef = ref(database, `games/${teamCode}`);
  const playersRef = ref(database, `games/${teamCode}/players`);

  useEffect(() => {
    if (teamCode.length > 0 && teamCode.length <= 9) {
      // 監聽遊戲數據
      const gameListener = onValue(gameRef, (snapshot) => {
        const value = snapshot.val();
        if (value) {
          setData(value.data || {}); // 確保更新層數數據
        }
      });
  
      // 監聽玩家列表
      const playersListener = onValue(playersRef, (snapshot) => {
        const value = snapshot.val();
        setPlayers(value || {}); // 更新玩家列表
  
        // 🔹 檢查所有玩家是否都 offline
        if (value) {
          const onlinePlayers = Object.values(value).filter((player) => player.online);
  
          // 如果所有玩家都 offline 或 `players` 變為空，刪除房間
          if (onlinePlayers.length === 0) {
            console.log(`No online players left, deleting room ${teamCode}.`);
            remove(gameRef)
              .then(() => remove(ref(database, `games/${teamCode}/resetTrigger`))) // 確保刪除 resetTrigger
              .then(() => console.log("Room deleted completely."))
              .catch((error) => console.error("Error deleting room:", error));
          }
        } else {
          // 如果玩家列表為空，也刪除房間
          console.log(`Player list empty, deleting room ${teamCode}.`);
          remove(gameRef)
            .then(() => remove(ref(database, `games/${teamCode}/resetTrigger`))) // 確保刪除 resetTrigger
            .then(() => console.log("Room deleted completely."))
            .catch((error) => console.error("Error deleting room:", error));
        }
      });
  
      // 監聽 Reset 事件
      const resetTriggerRef = ref(database, `games/${teamCode}/resetTrigger`);
      const resetListener = onValue(resetTriggerRef, (snapshot) => {
        if (snapshot.exists()) {
          console.log("Reset detected, clearing data and returning to layer 1.");
          setData(Array.from({ length: NUM_LAYERS }, () => ({}))); // 初始化本地數據
          setCurrentLayer(0); // 回到第 1 層
          setIsComplete(false); // 重置完成狀態
        }
      });
  
      // 清除監聽
      return () => {
        gameListener();
        playersListener();
        resetListener();
      };
    }
  }, [teamCode]);                      

  const joinRoom = () => {
    if (teamCode.length > 9 || !playerName) return;
  
    const db = getDatabase();
    const playerRef = ref(db, `games/${teamCode}/players/${playerName}`);
    const dataRef = ref(db, `games/${teamCode}/data`);
  
    onValue(playersRef, (snapshot) => {
      const players = snapshot.val();
  
      if (players && players[playerName]) {
        console.log(`${playerName} is reconnecting.`);
  
        // 🔹 找出該玩家目前的層數進度
        onValue(dataRef, (dataSnapshot) => {
          const allData = dataSnapshot.val();
          let lastLayer = 0;
  
          if (allData) {
            // 找到該玩家填寫數據的最後一層
            Object.keys(allData).forEach((layer) => {
              if (allData[layer]?.[playerName] !== undefined) {
                lastLayer = Math.max(lastLayer, parseInt(layer) + 1);
              }
            });
          }
  
          // 恢復當前層數並標記玩家為在線
          setCurrentLayer(lastLayer);
          setJoined(true);
  
          set(playerRef, { online: true })
            .then(() => console.log(`${playerName} rejoined and resumed from layer ${lastLayer}.`))
            .catch((error) => console.error("Error marking player as online:", error));
        }, { onlyOnce: true });
      } else {
        // 如果是新玩家，加入房間
        set(playerRef, { online: true }).then(() => {
          console.log(`${playerName} has joined the game.`);
          setJoined(true);
          setCurrentLayer(0); // 新玩家從第 0 層開始
  
          // 設定 onDisconnect 確保離開時標記為 offline
          onDisconnect(playerRef).set({ online: false }).then(() => {
            console.log(`${playerName} will be marked as offline on disconnect.`);
          });
        });
      }
    }, { onlyOnce: true });
  };                

  const handleSelectNumber = (number) => {
    if (currentLayer >= NUM_LAYERS) return;
  
    // 🔹 先即時更新本地數據，避免等待 Firebase 影響 UI
    const updatedData = { ...data };
    if (!updatedData[currentLayer]) {
      updatedData[currentLayer] = {};
    }
    updatedData[currentLayer][playerName] = number;
  
    // 🔹 立即更新本地 UI，讓按鈕不會閃爍
    setData(updatedData);
    setCurrentLayer((prevLayer) => prevLayer + 1);
  
    if (currentLayer + 1 === NUM_LAYERS) {
      setIsComplete(true);
    }
  
    // 🔹 再將數據寫入 Firebase（非同步）
    set(ref(database, `games/${teamCode}/data/${currentLayer}`), updatedData[currentLayer])
      .then(() => {
        console.log(`Successfully updated layer ${currentLayer} in Firebase.`);
      })
      .catch((error) => {
        console.error("Error updating layer data:", error);
      });
  };      

  const handleUndo = () => {
    if (currentLayer > 0) {
      // 🔹 更新本地數據，解除上一層的按鈕鎖定
      const updatedData = { ...data };
      const lastLayer = currentLayer - 1;
  
      if (updatedData[lastLayer]?.[playerName]) {
        // 🔹 刪除上一層玩家的數字選擇（解除鎖定）
        delete updatedData[lastLayer][playerName];
      }
  
      // 🔹 更新 Firebase 中的上一層數據
      set(ref(database, `games/${teamCode}/data/${lastLayer}`), updatedData[lastLayer] || {})
        .then(() => {
          console.log(`Undo: Unlocked number on layer ${lastLayer}.`);
        })
        .catch((error) => {
          console.error("Error updating layer data:", error);
        });
  
      // 🔹 更新本地狀態
      setData(updatedData);
      setCurrentLayer(lastLayer); // 返回上一層
      setIsComplete(false); // 清除完成狀態
    } else {
      console.log("Undo: Already at the first layer, cannot go back further.");
    }
  };    

  const handleExit = () => {
    if (!teamCode || !playerName) return;
  
    const playerRef = ref(database, `games/${teamCode}/players/${playerName}`);
    
    // 🔹 立即移除玩家資料
    remove(playerRef)
      .then(() => {
        console.log(`${playerName} removed from players list.`);
  
        // 🔹 檢查是否還有其他在線玩家
        onValue(playersRef, (snapshot) => {
          const players = snapshot.val();
          const onlinePlayers = Object.values(players || {}).filter(
            (player) => player.online
          );
  
          if (onlinePlayers.length === 0) {
            console.log(`No players left, deleting room ${teamCode}.`);
            
            // 刪除整個房間數據
            remove(gameRef).then(() =>
              console.log("Room deleted completely.")
            );
          }
        }, { onlyOnce: true });
      })
      .catch((error) => {
        console.error("Error removing player:", error);
      });
  
    // 🔹 清空本地狀態
    setJoined(false);
    setTeamCode("");
    setPlayerName("");
    setData({});
    setCurrentLayer(0);
    setIsComplete(false);
  };            

  const handleReset = () => {
    if (!teamCode) return;
  
    const resetTime = Date.now(); // 取得當前時間戳記
  
    // 🔹 初始化空的 `data` 結構，並保留玩家清單
    const updatedGameState = {
      players, // 保留玩家列表
      data: Array.from({ length: NUM_LAYERS }, () => ({})), // 初始化空的樓層結構
    };
  
    set(gameRef, updatedGameState)
      .then(() => {
        // 🔹 設定 resetTrigger，通知所有玩家
        return set(ref(database, `games/${teamCode}/resetTrigger`), resetTime);
      })
      .then(() => {
        // 🔹 同步清空本地狀態
        setData(updatedGameState.data); // 更新本地層數數據
        setCurrentLayer(0); // 回到第 1 層
        setIsComplete(false); // 重置完成狀態
        alert("Game has been reset. All players returned to layer 1.");
      })
      .catch((error) => {
        console.error("Error resetting data:", error);
      });
  };                

  const getDisabledNumbers = () => {
    const usedNumbers = new Set();
    if (data[currentLayer]) {
      Object.values(data[currentLayer]).forEach((value) => {
        usedNumbers.add(Number(value));
      });
    }
    return usedNumbers;
  };

  const getAvailableNumber = () => {
    const usedNumbers = new Set(getDisabledNumbers());
    const allNumbers = [1, 2, 3, 4];
    const availableNumbers = allNumbers.filter((num) => !usedNumbers.has(num));

    return availableNumbers.length === 1 ? availableNumbers[0] : null;
  };

  const disabledNumbers = getDisabledNumbers();
  const availableNumber = getAvailableNumber();

  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      {!joined ? (
        <div>
          <h2>Please input nickname and room ID:</h2>
          <input
            type="text"
            placeholder="Nickname"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            style={{ margin: "10px", padding: "5px" }}
          />
          <input
            type="text"
            placeholder="Room ID"
            maxLength="9" // 只允許最多9個字符
            value={teamCode}
            onChange={(e) => setTeamCode(e.target.value)}
            style={{ margin: "10px", padding: "5px" }}
          />
          <button onClick={joinRoom} style={{ padding: "10px 20px" }}>
            Join
          </button>
          {/* 🔹 Tool made by 70Neko */}
          <p style={{ fontSize: "14px", color: "#aaa", marginTop: "10px" }}>
            Tool made by <strong>70Neko</strong>
          </p>
        </div>
      ) : (
        <>
          <h2>Room ID: {teamCode}</h2>
          <h3>Players:</h3>
          {Object.keys(players).map((player) => (
            <div key={player}>{player}</div>
          ))}

          <h3>Current Layer: {Math.min(currentLayer + 1, NUM_LAYERS)}</h3>

          {isComplete && <p style={{ color: "green" }}>Clear! All layers completed.</p>}

          <table
            border="1"
            style={{
              margin: "20px auto",
              width: "80%",
              textAlign: "center",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr>
                <th>Player</th>
                {Array.from({ length: NUM_LAYERS }, (_, i) => (
                  <th key={i}>{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.keys(players).map((player) => (
                <tr key={player}>
                  <td>{player}</td>
                  {Array.from({ length: NUM_LAYERS }, (_, i) => (
                    <td key={i}>
                      {data[i]?.[player] || "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div>
            {[1, 2, 3, 4].map((num) => (
              <button
                key={num}
                onClick={() => handleSelectNumber(num)}
                disabled={disabledNumbers.has(num) || currentLayer >= NUM_LAYERS}
                style={{
                  margin: "5px",
                  padding: "10px 20px",
                  backgroundColor: disabledNumbers.has(num) ? "#ccc" : "#fff",
                  cursor: disabledNumbers.has(num) ? "not-allowed" : "pointer",
                  backgroundColor: availableNumber === num ? "#5cb85c" : "",
                }}
              >
                {num}
              </button>
            ))}
          </div>
          <button onClick={handleUndo} style={{ margin: "20px", padding: "10px 20px" }}>
            Undo
          </button>
          <button onClick={handleReset} style={{ margin: "20px", padding: "10px 20px", backgroundColor: "#007bff", color: "white" }}>
            Reset
          </button>
          <button onClick={handleExit} style={{ margin: "20px", padding: "10px 20px", backgroundColor: "#d9534f", color: "white" }}>
            Exit
          </button>
        </>
      )}
    </div>
  );
}

export default App;