
import re
from urllib.parse import quote

import requests


SEARCH_URL = "https://en.wikipedia.org/w/api.php"
SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary/"

HEADERS = {
    "User-Agent": "PythonVoiceAssistant/1.0 (educational project)"
}


def build_search_queries(question):
    """Convert conversational questions into better Wikipedia searches."""

    original = re.sub(r"[?!.,;:]+$", "", question.strip())
    queries = []

    # Handle questions about inventors, founders, creators, etc.
    patterns = [
        (r"^who\s+invented\s+(?:the\s+)?(.+)$", "inventor of"),
        (r"^who\s+founded\s+(?:the\s+)?(.+)$", "founder of"),
        (r"^who\s+created\s+(?:the\s+)?(.+)$", "creator of"),
        (r"^who\s+discovered\s+(?:the\s+)?(.+)$", "discoverer of"),
        (r"^who\s+wrote\s+(?:the\s+)?(.+)$", "author of"),
    ]

    for pattern, replacement in patterns:
        match = re.match(pattern, original, re.IGNORECASE)

        if match:
            subject = match.group(1).strip()
            queries.append(f"{replacement} {subject}")
            queries.append(f"{subject} {replacement}")
            break

    # Handle questions such as "Who is the founder of Pakistan?"
    if not queries:
        cleaned = re.sub(
            r"^who\s+(?:is|was)\s+(?:the\s+)?",
            "",
            original,
            flags=re.IGNORECASE
        )

        if cleaned != original:
            queries.append(cleaned)

    # Handle definition questions.
    if not queries:
        cleaned = re.sub(
            r"^(?:what|who)\s+(?:is|are|was|were)\s+(?:the\s+)?",
            "",
            original,
            flags=re.IGNORECASE
        )

        if cleaned != original:
            queries.append(cleaned)

    # Handle location questions.
    if not queries:
        cleaned = re.sub(
            r"^where\s+(?:is|are|was|were)\s+",
            "",
            original,
            flags=re.IGNORECASE
        )

        if cleaned != original:
            queries.append(cleaned)

    # Always keep the original question as a fallback.
    queries.append(original)

    # Remove duplicate queries.
    return list(dict.fromkeys(queries))


def get_short_summary(text):
    """Return up to two complete, reasonably short sentences."""

    text = " ".join(text.split())

    # Avoid splitting on abbreviations such as "lit."
    sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z])", text)

    answer_parts = []

    for sentence in sentences:
        sentence = sentence.strip()

        if not sentence:
            continue

        if len(answer_parts) >= 2:
            break

        answer_parts.append(sentence)

    answer = " ".join(answer_parts)

    # If the summary has no complete sentence, trim safely.
    if not answer:
        answer = text[:400].rsplit(" ", 1)[0] + "..."

    return answer


def get_knowledge_answer(question):
    """Find a relevant Wikipedia article and return its summary."""

    if not isinstance(question, str) or not question.strip():
        return "Please ask me a question."

    queries = build_search_queries(question)

    # Avoid returning the subject's general article for these questions.
    blocked_titles = set()

    match = re.match(
        r"^who\s+invented\s+(?:the\s+)?(.+)$",
        question.strip().rstrip("?.!"),
        re.IGNORECASE
    )

    if match:
        blocked_titles.add(match.group(1).strip().lower())

    match = re.match(
        r"^who\s+(?:is|was)\s+the\s+founder\s+of\s+(.+)$",
        question.strip().rstrip("?.!"),
        re.IGNORECASE
    )

    if match:
        blocked_titles.add(match.group(1).strip().lower())

    try:
        for search_query in queries:

            search_params = {
                "action": "query",
                "list": "search",
                "srsearch": search_query,
                "srwhat": "text",
                "srlimit": 8,
                "format": "json"
            }

            response = requests.get(
                SEARCH_URL,
                params=search_params,
                headers=HEADERS,
                timeout=15
            )

            response.raise_for_status()

            data = response.json()

            results = (
                data.get("query", {})
                .get("search", [])
            )

            for result in results:

                title = result.get("title", "").strip()

                if not title:
                    continue

                # Skip an article that only describes the subject.
                if title.lower() in blocked_titles:
                    continue

                summary_url = SUMMARY_URL + quote(title, safe="")

                summary_response = requests.get(
                    summary_url,
                    headers=HEADERS,
                    timeout=15
                )

                summary_response.raise_for_status()

                summary_data = summary_response.json()

                extract = summary_data.get("extract", "").strip()

                if not extract:
                    continue

                return get_short_summary(extract)

        return "Sorry, I couldn't find a suitable answer. Try asking in a different way."

    except requests.exceptions.Timeout:
        return "The knowledge service took too long to respond."

    except requests.exceptions.RequestException:
        return "I cannot connect to the knowledge service right now."

    except (ValueError, KeyError, TypeError):
        return "Sorry, I had trouble understanding the information received."


if __name__ == "__main__":

    print("\n===== GENERAL KNOWLEDGE TEST =====")
    print("Type 'exit' to stop.\n")

    while True:

        question = input("Ask a question: ").strip()

        if question.lower() in ["exit", "quit", "stop"]:
            print("Goodbye!")
            break

        answer = get_knowledge_answer(question)

        print("\nAssistant:", answer)
        print()
