import React, { useState, useEffect } from "react";
import { database, ref, set, onValue, remove } from "./firebase";
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
    if (teamCode.length <= 9) {
      const gameListener = onValue(gameRef, (snapshot) => {
        const value = snapshot.val();
        if (value) {
          setData(value);
        }
      });
  
      const playersListener = onValue(playersRef, (snapshot) => {
        const value = snapshot.val();
        setPlayers(value || {});
      });
  
      // 監聽 Reset 事件，清空本地數據並回到第一層
      const resetTriggerRef = ref(database, `games/${teamCode}/resetTrigger`);
      const resetListener = onValue(resetTriggerRef, (snapshot) => {
        if (snapshot.exists()) {
          console.log("Reset detected, clearing data and returning to layer 1.");
          setData({}); // 清空本地數據
          setCurrentLayer(0); // 回到第一層
          setIsComplete(false); // 重置完成狀態
        }
      });
  
      return () => {
        gameListener();
        playersListener();
        resetListener();
      };
    }
  }, [teamCode]);       

  const joinRoom = () => {
    if (teamCode.length > 9 || !playerName) return; // 確保 Room ID 只有最多9個字元

    onValue(playersRef, (snapshot) => {
      const players = snapshot.val();

      if (players && players[playerName]) {
        alert("This name is already in use. Please choose another name.");
        return;
      }

      setJoined(true);
      set(ref(database, `games/${teamCode}/players/${playerName}`), true);
    }, { onlyOnce: true });
  };

  const handleSelectNumber = (number) => {
    if (currentLayer >= NUM_LAYERS) return;

    const updatedData = { ...data };
    if (!updatedData[currentLayer]) updatedData[currentLayer] = {};

    updatedData[currentLayer][playerName] = number;
    set(gameRef, updatedData);

    if (currentLayer + 1 === NUM_LAYERS) {
      setIsComplete(true);
    }

    setCurrentLayer((prevLayer) => prevLayer + 1);
  };

  const handleUndo = () => {
    if (currentLayer > 0) {
      const updatedData = { ...data };
      const lastLayer = currentLayer - 1;

      if (updatedData[lastLayer]?.[playerName]) {
        delete updatedData[lastLayer][playerName];
      }

      set(gameRef, updatedData);
      setCurrentLayer(lastLayer);
      setIsComplete(false);
    }
  };

  const handleExit = () => {
    if (!teamCode || !playerName) return;

    const playerRef = ref(database, `games/${teamCode}/players/${playerName}`);
    
    remove(playerRef)
      .then(() => {
        const updatedData = { ...data };

        for (let i = 0; i < NUM_LAYERS; i++) {
          if (updatedData[i]?.[playerName]) {
            delete updatedData[i][playerName];
          }
        }

        return set(gameRef, updatedData);
      })
      .then(() => {
        return remove(playerRef);
      })
      .then(() => {
        onValue(playersRef, (snapshot) => {
          if (!snapshot.exists()) {
            remove(gameRef);
          }
        });

        setJoined(false);
        setTeamCode("");
        setPlayerName("");
        setData({});
        setCurrentLayer(0);
        setIsComplete(false);
      })
      .catch((error) => {
        console.error("Error removing player:", error);
      });
  };

  const handleReset = () => {
    if (!teamCode) return;
  
    const resetTime = Date.now(); // 取得當前時間戳記
  
    // 清除 Firebase 中的所有數據，並保留 players 清單
    set(gameRef, { players })
      .then(() => {
        // 設定 resetTrigger，讓所有玩家回到第一層
        return set(ref(database, `games/${teamCode}/resetTrigger`), resetTime);
      })
      .then(() => {
        // 本地狀態也同步清除
        setData({});
        setCurrentLayer(0);
        setIsComplete(false);
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