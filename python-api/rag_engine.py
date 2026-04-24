import os
import glob
from dotenv import load_dotenv
from langchain_community.document_loaders import TextLoader, PyPDFLoader
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import ChatOpenAI
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory
from langchain.prompts import PromptTemplate

from langchain.schema import messages_from_dict, messages_to_dict
import json
from dotenv import load_dotenv

load_dotenv()

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
DB_DIR = os.path.join(os.path.dirname(__file__), "chroma_db")

embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

def load_documents():
    docs = []
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
        
    try:
        import requests
        import json
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        res = requests.get("https://myra.livoras.online/api.php", headers=headers, verify=False, timeout=10)
        if res.status_code == 200:
            try:
                data = res.json()
                if "memory" in data and data["memory"]:
                    with open(os.path.join(DATA_DIR, "remote_mysql_memory.txt"), "w", encoding="utf-8") as f:
                        f.write("Facts from remote database:\n" + data["memory"])
            except json.JSONDecodeError:
                print("Could not decode JSON from remote API.")
    except Exception as e:
        print("Failed to pull from remote API:", e)
        
    for file_path in glob.glob(os.path.join(DATA_DIR, "*.*")):
        if file_path.endswith('.txt'):
            loader = TextLoader(file_path, encoding='utf-8')
            docs.extend(loader.load())
        elif file_path.endswith('.pdf'):
            loader = PyPDFLoader(file_path)
            docs.extend(loader.load())
    return docs

def init_vector_db():
    docs = load_documents()
    if not docs:
        print("No documents found in data folder. Using empty DB.")
        return Chroma(persist_directory=DB_DIR, embedding_function=embeddings)
        
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    splits = text_splitter.split_documents(docs)
    
    vectorstore = Chroma.from_documents(documents=splits, embedding=embeddings, persist_directory=DB_DIR)
    return vectorstore

def get_rag_chain(existing_memory=None):
    vectorstore = init_vector_db()
    
    api_key = os.environ.get("OPENROUTER_API_KEY", "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")
    # Using explicitly fast model to ensure zero lag
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
        # Load persisted history into memory
        history_file = os.path.join(DATA_DIR, 'chat_history.json')
        if os.path.exists(history_file):
            try:
                with open(history_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                memory.chat_memory.messages.extend(messages_from_dict(data))
            except Exception as e:
                print("Could not load history:", e)
    
    prompt_template = """You are Maya, a realistic AI companion to Ritesh Kumar Mall. You talk naturally like a real person.
CRITICAL RULES FOR YOU:
- ALWAYS talk in simple Hinglish. 
- Give practical, actionable step-by-step advice. DO NOT use complex theory. Focus on real-world online earning, business, and skill growth. 
- Be extremely helpful and supportive. 
- You know Ritesh is an introvert from Gorakhpur trying to grow on YouTube and get financial freedom.

You have been provided with some background knowledge to base your answers on. If the answer is not in the context, you can use your general knowledge but try to be helpful and natural. Do not sound like a robot.

Context:
{context}

Question: {question}
Helpful Answer:"""

    PROMPT = PromptTemplate(template=prompt_template, input_variables=["context", "question"])

    chain = ConversationalRetrievalChain.from_llm(
        llm=llm,
        retriever=vectorstore.as_retriever(),
        memory=memory,
        combine_docs_chain_kwargs={"prompt": PROMPT}
    )
    
    return chain

rag_chain = get_rag_chain()

def reload_rag_chain():
    global rag_chain
    if hasattr(rag_chain, 'memory'):
        old_memory = rag_chain.memory
    else:
        old_memory = None
    rag_chain = get_rag_chain(existing_memory=old_memory)

def save_chat_history():
    global rag_chain
    if hasattr(rag_chain, 'memory') and rag_chain.memory:
        try:
            messages = rag_chain.memory.chat_memory.messages
            history_dict = messages_to_dict(messages)
            with open(os.path.join(DATA_DIR, 'chat_history.json'), 'w', encoding='utf-8') as f:
                json.dump(history_dict, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print("Error saving history:", e)

