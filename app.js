const express= require("express")
const app= express()
const indexRouter= require("./routes/index")
const path= require("path")

const http = require("http")
const socketIO= require("socket.io")
const { log } = require("console")
const server= http.createServer(app)
const io= socketIO(server)

app.set("view engine","ejs")
app.use(express.json())
app.use(express.urlencoded({extended: true}))
app.use(express.static(path.join(__dirname, "public")))

app.use("/",indexRouter)

let waitingusers= []
let rooms= {}

io.on("connection",function(socket){
    socket.on("joinroom",function(){
        if(waitingusers.length>0){
            let partner= waitingusers.shift()
            const roomname= `${socket.id}-${partner.id}`

            socket.join(roomname)
            partner.join(roomname)

            rooms[socket.id] = roomname;
            rooms[partner.id] = roomname;

            io.to(roomname).emit("joined",roomname)
        }else{
            waitingusers.push(socket)
        }
    })

    socket.on("signalingMessage",function(data){
        // Ensure room exists before broadcasting
        if(!rooms[socket.id]) {
            console.log("Room not found for socket:", socket.id);
            return;
        }
        socket.broadcast.to(data.room).emit("signalingMessage",data.message); 
    })

    socket.on("message",function(data){
        socket.broadcast.to(data.room).emit("message",data.message); 
    })

    socket.on("startVideoCall",function(room){
        if(!rooms[socket.id]) {
            console.log("Room not found for video call");
            return;
        }
        socket.broadcast.to(room).emit("incomingCall"); 
    })

    socket.on("acceptCall",function(room){
        if(!rooms[socket.id]) return;
        socket.broadcast.to(room).emit("callAccepted"); 
    })

    socket.on("rejectCall",function(room){
        if(!rooms[socket.id]) return;
        socket.broadcast.to(room).emit("callRejected"); 
    })

    socket.on("disconnect",function(){
        // Remove from waiting users if present
        let index= waitingusers.findIndex(user => user.id === socket.id)
        if(index !== -1) {
            waitingusers.splice(index,1);
        }

        // Clean up room when user disconnects
        const roomname = rooms[socket.id];
        if(roomname) {
            socket.broadcast.to(roomname).emit("signalingMessage", JSON.stringify({
                type: "hangup"
            }));
            delete rooms[socket.id];
        }
    })
})

server.listen(3000)