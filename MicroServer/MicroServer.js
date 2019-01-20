const { spawn } = require("child_process");
const fs = require("fs");

const DEFAULT_PORT = 10391;

// Expected at least 1 arg (or 2)
const serverAddress = process.env.SERVER;

if (!serverAddress) {

    return -1;

}

let exit = false;
const socketIOClient = require("socket.io-client");
const socket = socketIOClient(serverAddress + "/sandbox");

setTimeout(() => exit = true, 10 * 60 * 1000);

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
        socket.emit("o", { "output": "The program exit with the status " + code });

    });

});

while (!exit);