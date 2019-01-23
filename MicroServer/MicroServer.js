const { spawn } = require("child_process");
const fs = require("fs");

const DEFAULT_PORT = 10391;

// Expected at least 1 arg (or 2)
const serverAddress = "http://0.0.0.0:8081";

if (!serverAddress) {

    console.log("Error: Server is not available.");
    return -1;

}

let exit = false;
const socketIOClient = require("socket.io-client");
const socket = socketIOClient(serverAddress + "/sandbox");

setTimeout(() => exit = true, 10 * 60 * 1000);

function uintToString(uintArray) {
    var encodedString = String.fromCharCode.apply(null, uintArray),
        decodedString = decodeURIComponent(escape(encodedString));
    return decodedString;
}

function stringToUint(string) {
    var string = btoa(unescape(encodeURIComponent(string))),
        charList = string.split(''),
        uintArray = [];
    for (var i = 0; i < charList.length; i++) {
        uintArray.push(charList[i].charCodeAt(0));
    }
    return new Uint8Array(uintArray);
}

socket.on("exec", function(data) {

    let dotnet = spawn("dotnet", ["run", "-p", "ConsoleApplication"]);
    dotnet.stdout.on("data", function(data) {

        socket.emit("o", { "output": uintToString(data) });
        
    });
    dotnet.stderr.on("data", function(data) {

        socket.emit("e", { "error": uintToString(data) });

    });
    let inputHandler = function(data) {

        dotnet.stdin.pipe(stringToUint(data.input));
            
    }
    socket.on("i", inputHandler);

    dotnet.on("exit", function(code, signal) {

        // End of executing 
        socket.removeListener("i", inputHandler);
        socket.emit("o", { "output": "The program exit with the status " + code });

    });

});