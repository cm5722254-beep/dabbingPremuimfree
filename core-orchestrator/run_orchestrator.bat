@echo off
title Cheatz Core Orchestrator (Java 21 Virtual Threads)
cd /d "%~dp0"
set JAVA_EXE=C:\Program Files\Android\Android Studio\jbr\bin\java.exe

if not exist "%JAVA_EXE%" (
    echo Java 21 not found at default path, trying system PATH...
    set JAVA_EXE=java
)

echo [Orchestrator] Starting Java 21 Loom Core Orchestrator on Port 8080...
"%JAVA_EXE%" --enable-preview -cp bin com.cheatz.dubbing.Application
pause

