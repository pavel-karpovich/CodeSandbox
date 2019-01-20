const { spawn } = require("child_process");
const fs = require("fs");

const SERVER_ADDRESS = process.argv.length > 2 ? process.argv[2] : undefined;
if (!SERVER_ADDRESS) {

    return -1;

}

let exit = false;
const socketIOClient = require("socket.io-client");
const socket = socketIOClient.connect(SERVER_ADDRESS);

socket.on("exec", function(data) {

    let dotnet = spawn("dotnet", ["run", "-p", "ConsoleApplication"]);
    dotnet.stdout.on("data", function(data) {

        socket.emit("o", { "output": data });
        
    });
    dotnet.stderr.on("data", function(data) {

        socket.emit("e", { "error": data });

    });
    let inputHandler = function(data) {

        dotnet.stdin.pipe(data.input);
            
    }
    socket.on("i", inputHandler);

    dotnet.on("exit", function(code, signal) {

        // End of executing 
        socket.removeListener("i", inputHandler);

    });

});

while (!exit);