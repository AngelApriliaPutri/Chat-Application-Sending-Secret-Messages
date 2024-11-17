const io = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto"); // Import modul

// Membuat RSA key pair : public key & private key
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 512, // Panjang kunci RSA
  publicKeyEncoding: { type: "spki", format: "pem" }, //Didaftarkan ke server
  privateKeyEncoding: { type: "pkcs8", format: "pem" }, //Untuk decrypt message
});

const socket = io("http://localhost:3000"); //Sambungkan ke server

const rl = readline.createInterface({ //Membuat Interface
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

let targetUsername = ""; // Target client 
let username = ""; // Usernamenya saat ini
const users = new Map(); // Menyimpan username & public key

socket.on("connect", () => {
  console.log("Connected to the server"); // Ketika berhasil connect ke server

  rl.question("Enter your username: ", (input) => { // Meminta inputan username
    username = input;
    console.log(`Welcome, ${username} to the chat`);

    socket.emit("registerPublicKey", { // Mengirim username & public key ke server untuk regist
      username,
      publicKey: publicKey,
    });
    rl.prompt();

    rl.on("line", (message) => {
      if (message.trim()) {
        if ((match = message.match(/^!secret (\w+)$/))) { // Prompt untuk secret chat sama client tertentu
          targetUsername = match[1];
          console.log(`Now secretly chatting with ${targetUsername}`);
        } else if (message.match(/^!exit$/)) { // Exit dari secret chat
          console.log(`No more secretly chatting with ${targetUsername}`);
          targetUsername = "";
        } else {
          if (targetUsername) {
            const encryptedMessage = encryptMessage(message, targetUsername); // Encrypt message dgn public key recipient
            if (encryptedMessage) {
              socket.emit("secretMessage", { sender: username, target: targetUsername, message: encryptedMessage }); // Mengirim message encrypt ke server
            }
          } else {
            socket.emit("message", { username, message }); // Mengirim pesan biasa
          }
        }
      }
      rl.prompt();
    });
  });
});

// Daftar client yang udah regist ke server
socket.on("init", (keys) => {
  keys.forEach(([user, key]) => users.set(user, key.publicKey));
  console.log(`\nThere are currently ${users.size} users in the chat`);
  rl.prompt();
});

// Client baru join
socket.on("newUser", (data) => {
  const { username, publicKey } = data;
  users.set(username, publicKey);
  console.log(`${username} joined the chat`);
  rl.prompt();
});

// Handle incoming regular messages
socket.on("message", (data) => {
  const { username: senderUsername, message: senderMessage } = data;
  if (senderUsername !== username) {
    console.log(`${senderUsername}: ${senderMessage}`);
    rl.prompt();
  }
});

socket.on("secretMessage", (data) => {
  const { sender, target, message } = data;

  if (target === username) {
    const decryptedMessage = decryptMessage(message); // Jika merupakan target message akan di decrypt
    console.log(`[Secret from ${sender}]: ${decryptedMessage}`);
  } else {
    // Jika bukan akan dalam bentuk ciphertext
    console.log(message);
  }
  rl.prompt();
});

// Client disconnect
socket.on("userDisconnected", (data) => {
  const { username } = data;
  users.delete(username);
  console.log(`${username} has left the chat.`);
  rl.prompt();
});

// Server disconnect
socket.on("disconnect", () => {
  console.log("Server disconnected, Exiting...");
  rl.close();
  process.exit(0);
});

rl.on("SIGINT", () => {
  console.log("\nExiting...");
  socket.disconnect();
  rl.close();
  process.exit(0);
});

function encryptMessage(message, target) {
  const targetPublicKey = users.get(target); // Mengambil public key recipient dari map users
  if (!targetPublicKey) {
    console.error(`No public key found for ${target}. Ensure ${target} is connected.`);
    return null;
  }
  // Encrypt message dengan public key recipient
  const encryptedMessage = crypto.publicEncrypt(targetPublicKey, Buffer.from(message));
  return encryptedMessage.toString("base64");
}

// Decrypt message dengan private key masing-masing
function decryptMessage(encryptedMessage) {
  const decryptedMessage = crypto.privateDecrypt(privateKey, Buffer.from(encryptedMessage, "base64"));
  return decryptedMessage.toString("utf8");
}
