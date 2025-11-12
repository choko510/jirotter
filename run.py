import uvicorn

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run FastAPI server")
    parser.add_argument("--host", type=str, default="localhost", help="Server host (default: localhost)")
    parser.add_argument("--port", type=int, default=8080, help="Server port (default: 8080)")
    parser.add_argument("--log", type=str, choices=["critical", "error", "warning", "info", "debug", "trace"],
                        default="info", help="Logging level (default: info)")
    args = parser.parse_args()

    uvicorn.run("app:create_app", host=args.host, port=args.port, log_level=args.log)
