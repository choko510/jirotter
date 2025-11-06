import uvicorn
import argparse

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Run the FastAPI application.")
    parser.add_argument("--port", type=int, default=8000, help="Port to run the server on.")
    parser.add_argument("--host", type=str, default="localhost", help="Host to bind the server to.")
    parser.add_argument("--no-reload", action="store_true", help="Disable auto-reloading.")
    args = parser.parse_args()

    uvicorn.run(
        "app:create_app",
        host=args.host,
        port=args.port,
        reload=(not args.no_reload),
        factory=True
    )
