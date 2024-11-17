const http = require("http");
const socketIo = require("socket.io"); // Import modul 

const server = http.createServer(); // Membuat server HTTP
const io = socketIo(server);

const users = new Map(); // Menyimpan username, socket ID, public key

io.on("connection", (socket) => {
  console.log(`Client ${socket.id} connected`);

  socket.emit("init", Array.from(users.entries())); // Mengirim data client yanng sudah regist

  socket.on("registerPublicKey", (data) => { // Regist public key client
    const { username, publicKey } = data;
    users.set(username, { socketId: socket.id, publicKey }); // Disimpan ke map
    console.log(`${username} registered with public key.`);

    io.emit("newUser", { username, publicKey }); // Broadcast ada client baru, mengirimkan username & public key
  });

  socket.on("message", (data) => { // Broadcast message biasa ke semua client
    const { username, message } = data;
    io.emit("message", { username, message }); 
  });

  socket.on("secretMessage", (data) => { // Broadcast secret message ke semua client
    const { sender, target, message } = data;
    const targetUser = users.get(target); 

    if (targetUser) { // Jika target user ditemukan dalam map
      io.to(targetUser.socketId).emit("secretMessage", { sender, target, message }); // Mengirim secret message ke target user

      users.forEach((value, key) => {
        if (key !== sender && key !== target) { // Mengirim ciphertext ke client lain (selain sender dan recipient)
          io.to(value.socketId).emit("secretMessage", { sender, target, message });
        }
      });
    } else {
      // Jika target user tidak ditemukan
      socket.emit("error", `User ${target} not found.`);
    }
  });

  // client disconnect
  socket.on("disconnect", () => {
    console.log(`Client ${socket.id} disconnected`);
    users.forEach((value, key) => {
      if (value.socketId === socket.id) {
        users.delete(key);
        io.emit("userDisconnected", { username: key }); // Broadcast user disconnection
        console.log(`${key} has disconnected`);
      }
    });
  });
});

// Menentukan port
const port = 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
