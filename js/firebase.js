// firebase.js
// Inicialização do Firebase (Frontend)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAzJzepXLG_6C6M0hMh4dodSsVwJzeR8TA",
    authDomain: "macicadobarbershop.firebaseapp.com",
    projectId: "macicadobarbershop",
    storageBucket: "macicadobarbershop.firebasestorage.app",
    messagingSenderId: "457966361157",
    appId: "1:457966361157:web:cb12fd5ae8321e10f9212c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
