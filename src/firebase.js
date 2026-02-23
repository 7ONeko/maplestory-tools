import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, remove, onDisconnect } from "firebase/database";

// 🔹 用你的 Firebase 設定替換這裡
const firebaseConfig = {
  apiKey: "AIzaSyDH4cJLuwIz7q8VNxamMfuSvFbA4MoKpR8",
  authDomain: "platform-game-309e1.firebaseapp.com",
  databaseURL: "https://platform-game-309e1-default-rtdb.firebaseio.com",
  projectId: "platform-game-309e1",
  storageBucket: "platform-game-309e1.firebasestorage.app",
  messagingSenderId: "982792835397",
  appId: "1:982792835397:web:a10a0254cd801565aeae2c"
};

initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider(
    "6LdUCXUsAAAAAC5Irp8p30QfVNGJMpB9-Xa6DaQI"
  ),
  isTokenAutoRefreshEnabled: true
});

// 🔥 初始化 Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { database, ref, set, onValue, remove, onDisconnect };


