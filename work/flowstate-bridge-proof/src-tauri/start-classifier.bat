@echo off
title FlowState Local EmbeddingGemma-2 Classifier
cd /d "%~dp0"
echo ===================================================
echo   FlowState Local Semantic Classifier on :8105
echo   Model: google/embeddinggemma-2 (Zero Cloud)
echo ===================================================
call "C:\Users\PC\laya-service\.venv\Scripts\python.exe" "%~dp0classifier.py"
pause
