const { spawn } = require("child_process");
const fs = require("fs");
const xml2js = require("xml2js");

// For a testing purposes:
/* 
docker build . -t test
docker rm $(docker stop $(docker ps -aq))
docker run --network=host -e SERVER=http://0.0.0.0:8081 -e ID=111 test
docker run 
*/

// Expected 2 env args
const serverAddress = process.env.SERVER;
const userId = process.env.ID;
const sessionId = process.env.SESSION;

console.log("Let's go");

if (serverAddress == undefined) {

    console.log("Error: Server is not available.");
    return -1;

}
else if (userId == undefined) {

    console.log("Error: User is not defined.");
    return -1;

}


const socketIOClient = require("socket.io-client");
const socket = socketIOClient(serverAddress + "/sandbox", { 
    query: `id=${userId}&session=${sessionId}`,
    reconnection: true,
    reconnectionAttempts: 10
});

const parser = new xml2js.Parser();
const testPath = "Code.Tests/TestResults/";


let dotnet = null;
let tests = null;

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

function loadCode(sourceCode) {

    console.log("load-code");
    if (sourceCode) {

        console.log("begin write code");
        try {

            fs.writeFileSync("./Code/Program.cs", sourceCode);
            console.log("end write code")
        } catch (err) {
            console.log("err!");
            socket.emit("err", { error: err });
            return -1;
        }
    }
}

let execStopped = false;
let testStopped = false;

socket.on("exec", function(data) {
        
    if (data && data.sourceCode) {
        loadCode(data.sourceCode);
    }
    console.log("run dotnet");
    dotnet = spawn("dotnet", ["run", "-p", "Run"]);
    socket.emit("start");
    
    dotnet.stdout.on("data", function(data) {

        console.log("stdout data");
        let decodedString = uintToString(data);
        socket.emit("output", { output: decodedString });
        
    });

    dotnet.stderr.on("data", function(data) {

        console.log("stderr data");
        let decodedStringErrorFromDotNet = uintToString(data);
        socket.emit("err", { error: decodedStringErrorFromDotNet });

    });

    let inputHandler = function(data) {

        console.log("inputttt");
        console.log(data.input);
        let encodedString =  stringToUint(data.input + "\n")
        try {

            dotnet.stdin.write(encodedString);
            dotnet.stdin.end();

        } catch (err) {

            socket.emit("err", { error: err });

        }
            
    }

    socket.on("input", inputHandler);

    dotnet.on("exit", function(code, signal) {

        socket.removeListener("input", inputHandler);

        if (!execStopped) {

            // End of executing 
            console.log("Exit-brexit");
            socket.emit("exec-end", { code: code });

        }
        execStopped = false;

    });
});

socket.on("stop", function() {
       
    console.log("stop this dude");
    execStopped = true;
    try {

        dotnet.stdin.pause();
        dotnet.kill();

    } catch (err) {

        socket.emit("err", { error: "Error when killing dotnet: " + err });

    }
    socket.emit("stop-end");

});


socket.on("load-code", function(data) {

    if (data) {
        loadCode(data.sourceCode);
    }

});

function loadTests(testsCode) {

    console.log("begin write test");
    try {

        fs.writeFileSync("./Code.Tests/UnitTest1.cs", testsCode);
        console.log("end write test");
    
    } catch (err) {
        console.log("err!");
        socket.emit("err", { error: err });
        return -1;
    }

}

socket.on("load-tests", function(data) {

    console.log("load-tests");
    if (data && data.testsCode) {
        loadTests(data.testsCode);
    }

});

async function parseStringAsync(xml) {
    return new Promise((resolve, reject) => {
        parser.parseString(xml, function (err, json) {
            if (err)
                reject(err);
            else
                resolve(json);
        });

    });
}

function clearTestOutput() {

    try {

        if (fs.existsSync(testPath)) {
            
            let files = fs.readdirSync(testPath);
            for (file of files) {

                fs.unlinkSync(testPath + file);
            
            }
        }

    } catch (err) {

        console.log(err);

    }
}

async function parseTestResultsAsync() {

    let ret = { status: "failed", results: [] };

    if (!fs.existsSync(testPath)) {

        return ret;
    }
    let files = fs.readdirSync(testPath);
    if (files.length == 0) {

        return ret;

    }
    let filename = files[0];
    if (filename) {

        console.log(filename);
        try {

            let filedata = fs.readFileSync(testPath + filename);
            let result = await parseStringAsync(filedata);

            console.log(result);
            for (let test of result.TestRun.Results[0].UnitTestResult) {

                console.log(test);
                if (test.$.outcome == "Failed") {

                    let msg = test.Output[0].ErrorInfo[0].Message[0];
                    console.log(msg);
                    msg = msg.slice(0, msg.indexOf("Expected:"));
                    ret.results.push(msg);
                }
            }
            if (ret.results.length == 0) {
                ret.status = "passed";
            }

        } catch (excp) {
            console.log(excp);
        }
        clearTestOutput();
    }
    return ret;
}

socket.on("test", function(data) {

    if (data) {

        if (data.sourceCode) {
            loadCode(data.sourceCode);
        }
        if (data.testsCode) {
            loadTests(data.testsCode);
        }

    }
    console.log("run tests");
    tests = spawn("dotnet", ["test", "-l", "trx"]);
    socket.emit("start-test");
    
    tests.on("exit", function(code, signal) {

        // End of executing 
        if (!testStopped) {
        
            console.log("End of testing");
            parseTestResultsAsync()
            .then(function(testResults) {

                console.dir(testResults);
                socket.emit("test-end", testResults);

            })
            .catch(function(err) {
                console.log(err);
            });
        
        }
        testStopped = false;

    });

    

});

socket.on("stop-test", function() {

    console.log("stop test execution");
    testStopped = true;
    try {

        tests.stdin.pause();
        tests.kill();

    } catch (err) {

        socket.emit("err", { error: "Error when killing tests: " + err });

    }
    clearTestOutput();
    socket.emit("stop-test-end");

});

function closeContainer() {

    console.log("exit with code 0");
    process.exit();

}

socket.on("exit", closeContainer);

socket.on("disconnect", closeContainer);