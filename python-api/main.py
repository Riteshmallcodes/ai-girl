from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
import shutil
import wikipedia
import rag_engine
from langchain.schema import HumanMessage

# Copy the generated background to the frontend
try:
    src_img = r"C:\Users\Dell\.gemini\antigravity\brain\a3181682-dee2-4d58-b2c3-8e791f05795f\fairy_palace_throne_1776643291335.png"
    dest_dir = r"d:\ai girl\frontend\public\backgrounds"
    os.makedirs(dest_dir, exist_ok=True)
    shutil.copy(src_img, os.path.join(dest_dir, "palace.png"))
except Exception as e:
    print("Bg cp eq:", e)

app = FastAPI(title="Maya RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    content: str

@app.post("/api/chat/message")
async def chat_message(req: ChatRequest):
    try:
        if not req.content.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")
            
        print(f"Received query: {req.content}")
        
        # 1. Fast Keyword-Based Intent Classification
        content_lower = req.content.lower().strip()
        
        intent_res = "CHAT"
        topic = ""
        fact = ""
        
        if content_lower.startswith("search ") or content_lower.startswith("search for ") or " ko search karo" in content_lower:
            intent_res = "INTERNET_SEARCH"
            topic = content_lower.replace("search for", "").replace("search", "").replace("ko search karo", "").strip()
        elif "yaad rakhna" in content_lower or "remember that " in content_lower:
            intent_res = "REMEMBER"
            fact = req.content.replace("yaad rakhna", "").replace("remember that", "").replace("ki", "").strip()
            
        print(f"Detected Intent: {intent_res}")
        
        if intent_res == "INTERNET_SEARCH" and topic:
            try:
                try:
                    summary = wikipedia.summary(topic, sentences=10)
                except wikipedia.exceptions.DisambiguationError as e:
                    summary = wikipedia.summary(e.options[0], sentences=10)
                    
                filename = f"learned_{topic.replace(' ', '_')}.txt".replace('/', '_').replace('\\', '_')
                filepath = os.path.join(rag_engine.DATA_DIR, filename)
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(f"Knowledge about {topic} from the internet:\n{summary}\n")
                
                rag_engine.reload_rag_chain()
                reply = f"I have searched the internet and successfully learned about {topic}!"
                rag_engine.save_chat_history() # call to new history saving
                return {"reply": reply, "audioUrl": None}
            except Exception as e:
                print(f"Wiki error: {e}")
                # Fall back to normal chat if internet parsing failed
                
        elif intent_res == "REMEMBER" and fact:
            # 1. Save locally
            filepath = os.path.join(rag_engine.DATA_DIR, "user_taught_facts.txt")
            with open(filepath, "a", encoding="utf-8") as f:
                f.write(f"{fact}\n")
            
            # 2. Save to Remote Livoras API (MySQL)
            try:
                import requests
                remote_url = "https://myra.livoras.online/api.php"
                headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
                res = requests.post(remote_url, data={"fact": fact}, headers=headers, verify=False, timeout=10)
                if res.status_code == 200:
                    print("Successfully saved to remote Livoras API:", res.text)
                    reply = f"Sikh liya! Aur isko database me bhi save kar diya hai: {res.text}"
                else:
                    print(f"Failed remote API: HTTP {res.status_code} - {res.text}")
                    reply = f"Maine fact local to yaad kar liya, par server par bhejte waqt error aaya! Code {res.status_code}: {res.text}"
            except Exception as e:
                print(f"Exception saving to remote API: {e}")
                reply = f"Server par save nahi ho paya, Python error aaya: {e}"
                
            rag_engine.reload_rag_chain()
            rag_engine.save_chat_history()
            return {"reply": reply, "audioUrl": None}

        # 2. Proceed with Normal Chat
        response = rag_engine.rag_chain.invoke({"question": req.content})
        reply = response["answer"]
        print(f"Generated reply: {reply}")
        
        rag_engine.save_chat_history() # Save normal chat turns
        
        return {
            "reply": reply,
            "audioUrl": None
        }
    except Exception as e:
        print(f"Error processing chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health():
    return {"status": "ok", "sttProvider": "none"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
