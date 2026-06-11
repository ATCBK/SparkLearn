# Spark C++ Bridge Build Notes

The bridge source is located at:

- `backend/bridge/src/spark_bridge.cpp`

Runtime binary target:

- `backend/bridge/bin/spark_bridge.exe`

## Build Requirements

1. Visual Studio Build Tools (MSVC) with C++ workload
2. `cl.exe` available in shell (Developer Command Prompt), or MSBuild project integration

## Current Environment Note

If `cl.exe` / `msbuild` is not present in PATH, the bridge cannot be compiled in this shell.
In that case, backend falls back to direct Spark WebSocket integration in `backend/app/llm.py`.

