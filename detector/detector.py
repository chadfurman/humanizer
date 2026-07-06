"""Supervised AI-text detector: desklib/ai-text-detector-v1.01.

A DeBERTa classifier that fails differently than the heuristic grader, which is
the point — agreement across independent methods is the signal. NEVER a gate:
detectors measure prose predictability, not authorship.

Usage: .venv/bin/python detector.py <file.md> [more files...]
"""

import re
import sys
from pathlib import Path

import torch
import torch.nn as nn
from transformers import AutoConfig, AutoModel, AutoTokenizer, PreTrainedModel

MODEL_ID = "desklib/ai-text-detector-v1.01"


class DesklibAIDetectionModel(PreTrainedModel):
    config_class = AutoConfig

    def __init__(self, config):
        super().__init__(config)
        self.model = AutoModel.from_config(config)
        self.classifier = nn.Linear(config.hidden_size, 1)
        self.init_weights()

    def forward(self, input_ids, attention_mask=None):
        outputs = self.model(input_ids, attention_mask=attention_mask)
        hidden = outputs[0]
        mask = attention_mask.unsqueeze(-1).expand(hidden.size()).float()
        pooled = torch.sum(hidden * mask, 1) / torch.clamp(mask.sum(1), min=1e-9)
        return self.classifier(pooled)


def ai_probability(text: str, model, tokenizer, device) -> float:
    enc = tokenizer(text, padding="max_length", truncation=True, max_length=768, return_tensors="pt")
    with torch.no_grad():
        logits = model(enc["input_ids"].to(device), attention_mask=enc["attention_mask"].to(device))
    return torch.sigmoid(logits).item()


def main() -> None:
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = DesklibAIDetectionModel.from_pretrained(MODEL_ID).to(device).eval()
    for arg in sys.argv[1:]:
        raw = Path(arg).read_text()
        body = re.sub(r"^---\n[\s\S]*?\n---\n", "", raw)
        # score in ~500-word chunks and report the mean + worst chunk
        words = body.split()
        chunks = [" ".join(words[i : i + 500]) for i in range(0, len(words), 500)] or [body]
        probs = [ai_probability(c, model, tokenizer, device) for c in chunks]
        mean = sum(probs) / len(probs)
        print(f"{Path(arg).name}: ai_prob mean={mean:.2f} worst_chunk={max(probs):.2f} chunks={len(probs)}")


if __name__ == "__main__":
    main()
