import cachetools

cache = cachetools.TTLCache(maxsize=1000, ttl=300)

def tokenize(text: str):
    return text.split()
