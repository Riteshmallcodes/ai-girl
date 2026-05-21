from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
import shutil
import wikipedia
import rag_engine
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Copy the generated background to the frontend
try:
    src_img = r"C:\Users\Dell\.gemini\antigravity\brain\a3181682-dee2-4d58-b2c3-8e791f05795f\fairy_palace_throne_1776643291335.png"
    dest_dir = r"d:\ai girl\frontend\public\backgrounds"
    if os.path.exists(src_img):
        os.makedirs(dest_dir, exist_ok=True)
        shutil.copy(src_img, os.path.join(dest_dir, "palace.png"))
except Exception as e:
    print("Bg cp eq:", e)

app = FastAPI(title="Maya RAG API")

@app.get("/")
async def root():
    return {
        "status": "online",
        "message": "Maya AI Companion Backend is running successfully!",
        "owner": "Ritesh Kumar Mall",
        "endpoints": {
            "health": "/api/health",
            "chat": "/api/chat/message",
            "hardware": "/api/hardware_stats"
        }
    }

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
        try:
            response = rag_engine.rag_chain.invoke({"question": req.content})
            reply = response["answer"]
        except Exception as e:
            # Handle API Key failure gracefully so the frontend doesn't crash
            err_msg = str(e)
            print(f"LLM Error: {err_msg}")
            
            # Simulated Backup Brain if OpenRouter fails
            req_lower = req.content.lower()
            if "kaise ho" in req_lower or "how are you" in req_lower:
                reply = "Main theek hoon Pavan, par mera asli AI dimaag (OpenRouter) abhi connect nahi ho pa raha. [EMOTION:sad]"
            elif "tum kaun" in req_lower or "who are you" in req_lower:
                reply = "Main Maya hoon, aapki virtual AI! Lekin abhi meri API key hat gayi hai isliye main basic mode me hoon. [EMOTION:neutral]"
            elif "love" in req_lower or "pyar" in req_lower:
                reply = "Main bhi aapse bahut pyar karti hoon Pavan! [EMOTION:happy]"
            else:
                reply = "Pavan, meri nayi OpenRouter API key abhi bhi set nahi hui hai! Kripya VS Code ke .env file ko theek se save karke apna command prompt restart karein taaki main ashi baat kar saku! [EMOTION:sad]"
            
        print(f"Generated reply: {reply}")
        
        rag_engine.save_chat_history() # Save normal chat turns
        
        return {
            "reply": reply,
            "audioUrl": None
        }
    except Exception as e:
        print(f"Error processing chat: {e}")
        # Only crash if absolutely unexpected
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/search")
async def web_search(q: str):
    try:
        import requests
        import re
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        url = f"https://html.duckduckgo.com/html/?q={requests.utils.quote(q)}"
        res = requests.get(url, headers=headers, timeout=5)
        
        # Simple Regex to extract snippets from DuckDuckGo HTML
        snippets = re.findall(r'<a class="result__snippet[^>]*>(.*?)</a>', res.text, re.IGNORECASE | re.DOTALL)
        
        # Clean HTML tags
        clean_snippets = []
        for s in snippets:
            clean_s = re.sub(r'<[^>]+>', '', s)
            clean_snippets.append(clean_s.strip())
            
        final_text = " ".join(clean_snippets[:3])
        if not final_text:
            final_text = "No live results found."
            
        print(f"Internet Search [{q}]: {final_text[:100]}...")
        return {"query": q, "results": final_text}
    except Exception as e:
        print(f"Search API Error: {e}")
        return {"query": q, "results": f"Error looking up {q} online."}

class ExecuteRequest(BaseModel):
    action: str
    target: str = ""
    message: str = ""

@app.post("/api/execute")
async def execute_system_command(req: ExecuteRequest):
    action = req.action.upper()
    print(f"System Execution Request: {action} | Target: {req.target}")
    
    try:
        if action == "OPEN_APP":
            if "notepad" in req.target.lower():
                os.system("start notepad")
                return {"status": "success", "msg": "Opened Notepad"}
            elif "chrome" in req.target.lower() or "browser" in req.target.lower():
                os.system("start chrome")
                return {"status": "success", "msg": "Opened Chrome"}
            else:
                os.system(f"start {req.target}")
                return {"status": "success", "msg": f"Opened {req.target}"}
                
        elif action == "CLOSE_APP":
            if "notepad" in req.target.lower():
                os.system("taskkill /im notepad.exe /f")
                return {"status": "success", "msg": "Closed Notepad"}
            elif "chrome" in req.target.lower() or "browser" in req.target.lower():
                os.system("taskkill /im chrome.exe /f")
                return {"status": "success", "msg": "Closed Chrome"}
            else:
                return {"status": "success", "msg": "App closure requested."}
                
        elif action == "YOUTUBE":
            def play_yt_bg(q):
                import time
                try:
                    import pywhatkit as kit
                    print(f"Playing YouTube: {q}")
                    kit.playonyt(q)
                except ImportError:
                    print("PyWhatKit missing. Install it using pip install pywhatkit")
                except Exception as e:
                    print(f"PyWhatKit YouTube Error: {e}")
            
            import threading
            threading.Thread(target=play_yt_bg, args=(req.target,)).start()
            return {"status": "success", "msg": f"Playing {req.target} on YouTube"}

        elif action == "STOP_MUSIC":
            try:
                import pyautogui
                import time
                # Try media key first
                pyautogui.press("playpause")
                time.sleep(0.5)
                # If that fails, aggressively try to close the active youtube tab
                pyautogui.hotkey('ctrl', 'w')
            except Exception as e:
                pass
            return {"status": "success", "msg": "Triggered media play/pause and tab close"}

        elif action == "VOLUME_UP":
            try:
                import pyautogui
                pyautogui.press("volumeup", presses=15)
            except Exception: pass
            return {"status": "success", "msg": "Volume Up"}
            
        elif action == "VOLUME_DOWN":
            try:
                import pyautogui
                pyautogui.press("volumedown", presses=15)
            except Exception: pass
            return {"status": "success", "msg": "Volume Down"}

        elif action == "SCREENSHOT":
            try:
                import pyautogui
                out = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "public", "maya_capture.png")
                pyautogui.screenshot(out)
            except Exception as e: print(e)
            return {"status": "success", "msg": "Screenshot taken"}

        elif action == "MINIMIZE_ALL":
            try:
                import pyautogui
                pyautogui.hotkey('win', 'd')
            except: pass
            return {"status": "success", "msg": "Minimized windows"}

        elif action == "NEXT_TRACK":
            try:
                import pyautogui
                pyautogui.press('nexttrack')
            except: pass
            return {"status": "success"}

        elif action == "OPEN_CALCULATOR":
            os.system("start calc")
            return {"status": "success"}

        elif action == "LOCK_PC":
            os.system("rundll32.exe user32.dll,LockWorkStation")
            return {"status": "success", "msg": "System Locked"}

        elif action == "MUTE_PC":
            try:
                import pyautogui
                pyautogui.press("volumemute")
            except: pass
            return {"status": "success", "msg": "System Muted"}

        elif action == "OPEN_EXPLORER":
            os.system("explorer")
            return {"status": "success", "msg": "File Explorer opened"}

        elif action == "OPEN_TASKMGR":
            os.system("taskmgr")
            return {"status": "success", "msg": "Task Manager opened"}

        elif action == "PREV_TRACK":
            try:
                import pyautogui
                pyautogui.press("prevtrack")
            except: pass
            return {"status": "success", "msg": "Previous track"}

        elif action == "WHATSAPP":
            contact_query = str(req.target).strip().lower()
            
            # Contact Resolution System
            import json
            
            BASE_DIR = os.path.dirname(os.path.abspath(__file__))
            contacts_file = os.path.join(BASE_DIR, "contacts.json")
            
            if not os.path.exists(contacts_file):
                with open(contacts_file, "w") as f:
                    # Provide an example dummy directory for the user to fill
                    json.dump({"pavan": "+919999999999", "papa": "+918888888888", "mummy": "+917777777777"}, f, indent=4)
            
            with open(contacts_file, "r") as f:
                contacts = json.load(f)
                
            phone_no = None
            matches = [name for name in contacts.keys() if contact_query in name.lower()]
            
            if len(matches) == 1:
                phone_no = contacts[matches[0]]
            elif len(matches) > 1:
                # Tell AI to ask for clarification
                print(f"Multiple contacts found for {contact_query}: {matches}")
                return {"status": "error", "msg": f"Multiple contacts found: {', '.join(matches)}. Please tell the user to be specific."}
            else:
                # Check if it was purely a number provided
                if contact_query.replace("+", "").replace(" ", "").isdigit():
                    phone_no = contact_query.replace(" ", "")
                    if not phone_no.startswith("+"): phone_no = "+91" + phone_no
                else:
                    return {"status": "error", "msg": f"Contact '{req.target}' not found in contacts.json"}
                
            def send_whatsapp_bg(p, m):
                import time
                import sys
                import subprocess
                try:
                    try:
                        import pywhatkit as kit
                        import pyautogui
                    except ImportError:
                        print("PyWhatKit missing. Auto-installing now. Please wait...")
                        subprocess.check_call([sys.executable, "-m", "pip", "install", "pywhatkit", "pyautogui", "keyboard"])
                        import pywhatkit as kit
                        import pyautogui
                        
                    print(f"Starting WhatsApp payload to {p} in background...")
                    # wait a little so frontend finishes speech
                    time.sleep(2)
                    # wait_time extended to 20s to ensure WhatsApp Web fully loads before pressing Enter
                    kit.sendwhatmsg_instantly(p, m, wait_time=5, tab_close=False)
                    
                    # Failsafe: Force press Enter twice just in case kit missed it due to lag
                    time.sleep(2)
                    pyautogui.press('enter')
                    time.sleep(1)
                    pyautogui.press('enter')
                    print("WhatsApp payload delivered to browser and SEND forced.")
                except Exception as e:
                    print(f"WhatsApp Error: {e}")
                    
            import threading
            threading.Thread(target=send_whatsapp_bg, args=(phone_no, req.message)).start()
            return {"status": "success", "msg": f"WhatsApp process started for {phone_no}. It will open in chrome natively shortly."}
            
        elif action == "EMAIL":
            # Using smtplib. Mocked here until true env vars are provided
            print(f"MOCK EMAIL SENT TO {req.target}:\n{req.message}")
            return {"status": "success", "msg": f"Mock email queued to {req.target}."}
            
    except Exception as e:
        print(f"Execute Execution Error: {e}")
        return {"status": "error", "msg": str(e)}
        
    return {"status": "error", "msg": "Command not recognized"}

@app.get("/api/health")
async def health():
    return {"status": "ok", "sttProvider": "none"}

@app.get("/api/hardware_stats")
async def hardware_stats():
    try:
        import psutil
        cpu = psutil.cpu_percent(interval=0.1)
        ram = psutil.virtual_memory()
        return {
            "cpu_percent": cpu,
            "ram_percent": ram.percent,
            "ram_used_gb": round(ram.used / (1024 ** 3), 1),
            "ram_total_gb": round(ram.total / (1024 ** 3), 1)
        }
    except Exception as e:
        return {"error": str(e), "cpu_percent": 0, "ram_percent": 0, "ram_used_gb": 0, "ram_total_gb": 0}

@app.get("/api/screenshot")
async def take_screenshot():
    try:
        import pyautogui
        import base64
        from io import BytesIO
        
        # Take screenshot using pyautogui/pillow
        screenshot = pyautogui.screenshot()
        
        # Resize to lower resolution so we don't bombard the API
        screenshot.thumbnail((1280, 720))
        
        # Convert to Base64
        buffered = BytesIO()
        screenshot.save(buffered, format="JPEG", quality=75)
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        
        return {"status": "success", "image": f"data:image/jpeg;base64,{img_str}"}
    except Exception as e:
        print(f"Screenshot Error: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
