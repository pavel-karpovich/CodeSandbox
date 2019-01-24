const { spawn } = require("child_process");
const fs = require("fs");

// Expected 2 env args
const serverAddress = process.env.SERVER;
const userId = process.env.ID;
console.log("Let's go");
if (!serverAddress) {

    console.log("Error: Server is not available.");
    return -1;

}
if (!userId) {

    console.log("Error: User is not defined.");
    return -1;
}

const socketIOClient = require("socket.io-client");
const socket = socketIOClient(serverAddress + "/sandbox", { query: `id=${userId}` });

function uintToString(uintArray) {
    var encodedString = String.fromCharCode.apply(null, uintArray),
        decodedString = decodeURIComponent(escape(encodedString));
    return decodedString;
}

function stringToUint(string) {
    var string = unescape(encodeURIComponent(string)),
        charList = string.split(''),
        uintArray = [];
    for (var i = 0; i < charList.length; i++) {
        uintArray.push(charList[i].charCodeAt(0));
    }
    return new Uint8Array(uintArray);
}

let dotnet = null;

function runDotnet() {
        
    console.log("run dotnet");
    dotnet = spawn("dotnet", ["run", "-p", "ConsoleApplication"]);
    socket.emit("start", { userId });
    
    dotnet.stdout.on("data", function(data) {

        console.log("stdout data");
        let decodedString = uintToString(data);
        socket.emit("o", { userId, output: decodedString });
        
    });

    dotnet.stderr.on("data", function(data) {

        console.log("stderr data");
        let decodedString = uintToString(data);
        socket.emit("e", { userId, error: decodedString });

    });

    let inputHandler = function(data) {

        console.log("inputttt");
        let encodedString =  stringToUint(data.input + "\n")
        console.log(encodedString);
        dotnet.stdin.write(encodedString);
        dotnet.stdin.end();
            
    }

    socket.on("i", inputHandler);

    socket.on("stop", function() {
       
        console.log("stop this dude");
        dotnet.stdin.pause();
        dotnet.kill();

    });

    dotnet.on("exit", function(code, signal) {

        // End of executing 
        console.log("Exit-brexit");
        socket.removeListener("i", inputHandler);
        socket.emit("end", { userId, code: code });

    });
}

socket.on("exec", function(data) {

    console.log("exec");
    if (data.sourceCode) {

        console.log("data: " + data.sourceCode);
        console.log("begin write");
        fs.writeFile("./ConsoleApplication/Program.cs", data.sourceCode, (err) => {

            console.log("end write");
            if (err) {

                console.log("err!");
                socket.emit("e", { userId, error: err });
                return -1;

            }
            runDotnet();

        });

    } else {

        runDotnet();

    }

});

socket.on("exit", function() {

    process.exit();

});