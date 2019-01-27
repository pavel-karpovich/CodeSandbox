FROM microsoft/dotnet:latest

RUN curl -sL https://deb.nodesource.com/setup_10.x | bash - \ 
	&& apt update \
&& apt install -y nodejs

COPY MicroServer /MicroServer
WORKDIR /MicroServer

RUN npm i 

RUN dotnet new sln && \
    dotnet new classlib -o Code && \
	mv ./Code/Class1.cs ./Code/Program.cs && \
	dotnet sln add ./Code/Code.csproj && \
	dotnet new xunit -o Code.Tests && \
	dotnet sln add ./Code.Tests/Code.Tests.csproj && \
	cd Code.Tests && dotnet add reference ../Code/Code.csproj && cd .. && \
	dotnet new console -o Run && \
	dotnet sln add ./Run/Run.csproj && \
	cd Run && dotnet add reference ../Code/Code.csproj

COPY Program.cs ./Run/Program.cs

ENTRYPOINT node MicroServer.js