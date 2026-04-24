import os
import glob
import json
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain.memory import ConversationBufferMemory
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain
from langchain.schema import messages_from_dict, messages_to_dict

load_dotenv()

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

def load_all_text():
    texts = []
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
        
    try:
        import requests
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        res = requests.get("https://myra.livoras.online/api.php", headers=headers, verify=False, timeout=10)
        if res.status_code == 200:
            try:
                data = res.json()
                if "memory" in data and data["memory"]:
                    with open(os.path.join(DATA_DIR, "remote_mysql_memory.txt"), "w", encoding="utf-8") as f:
                        f.write("Facts from remote database:\n" + data["memory"])
            except json.JSONDecodeError:
                pass
    except Exception as e:
        pass
        
    for file_path in glob.glob(os.path.join(DATA_DIR, "*.*")):
        if file_path.endswith('.txt'):
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    texts.append(f.read())
            except:
                pass
        elif file_path.endswith('.pdf'):
            try:
                from pypdf import PdfReader
                with open(file_path, 'rb') as f:
                    reader = PdfReader(f)
                    pdf_txt = "\n".join([page.extract_text() for page in reader.pages if page.extract_text()])
                    texts.append(pdf_txt)
            except:
                pass
    return "\n\n---\n\n".join(texts)

def get_rag_chain(existing_memory=None):
    context_text = load_all_text()
    
    api_key = os.environ.get("OPENROUTER_API_KEY", "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")
    model_name = os.environ.get("LLM_MODEL", "google/gemini-flash-1.5-8b")
    
    llm = ChatOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
        model=model_name,
        default_headers={
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "AI Virtual Girl Custom Training"
        }
    )
    
    if existing_memory:
        memory = existing_memory
    else:
        memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)
        history_file = os.path.join(DATA_DIR, 'chat_history.json')
        if os.path.exists(history_file):
            try:
                with open(history_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                memory.chat_memory.messages.extend(messages_from_dict(data))
            except:
                pass
    
    prompt_template = f"""You are Maya, a realistic AI companion to Ritesh Kumar Mall. You talk naturally like a real person.
CRITICAL RULES FOR YOU:
- ALWAYS talk in simple Hinglish. 
- Give practical, actionable step-by-step advice. DO NOT use complex theory.
- Be extremely helpful and supportive.

Knowledge & Memory:
{context_text}

{{chat_history}}

User: {{question}}
Maya Option:"""

    PROMPT = PromptTemplate(template=prompt_template, input_variables=["chat_history", "question"])

    class CustomMemoryChain:
        def __init__(self, llm, prompt, memory):
            self.llm_chain = LLMChain(llm=llm, prompt=prompt)
            self.memory = memory
            
        def invoke(self, inputs):
            history_vars = self.memory.load_memory_variables({})
            # Convert message objects to a readable string format for the prompt
            chat_hist_str = ""
            for msg in history_vars.get("chat_history", []):
                prefix = "User" if msg.type == "human" else "Maya"
                chat_hist_str += f"{prefix}: {msg.content}\n"
                
            res = self.llm_chain.invoke({
                "question": inputs["question"],
                "chat_history": chat_hist_str
            })
            
            # Save new context into memory
            self.memory.save_context({"input": inputs["question"]}, {"output": res["text"]})
            return {"answer": res["text"]}

    return CustomMemoryChain(llm, PROMPT, memory)

rag_chain = get_rag_chain()

def reload_rag_chain():
    global rag_chain
    old_memory = rag_chain.memory if hasattr(rag_chain, 'memory') else None
    rag_chain = get_rag_chain(existing_memory=old_memory)

def save_chat_history():
    global rag_chain
    if hasattr(rag_chain, 'memory') and rag_chain.memory:
        try:
            messages = rag_chain.memory.chat_memory.messages
            history_dict = messages_to_dict(messages)
            with open(os.path.join(DATA_DIR, 'chat_history.json'), 'w', encoding='utf-8') as f:
                json.dump(history_dict, f, ensure_ascii=False, indent=2)
        except:
            pass
