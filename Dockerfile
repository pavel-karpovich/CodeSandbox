FROM microsoft/dotnet:latest

RUN curl -sL https://deb.nodesource.com/setup_10.x | bash - \ 
	&& apt update \
&& apt install -y nodejs

COPY MicroServer /MicroServer
WORKDIR /MicroServer

RUN npm i 

RUN dotnet new console -o ConsoleApplication

ENTRYPOINT node MicroServer.js