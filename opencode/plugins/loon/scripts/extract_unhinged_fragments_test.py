"""Tests for selecting exclamation fragments without calling the OpenCode server."""

import json
import unittest
from unittest.mock import patch

from extract_unhinged_fragments import exclamation_fragment, pages, reasoning_fragments


class ExtractUnhingedFragmentsTest(unittest.TestCase):
    def test_takes_exclamation_and_sentence_before_it(self):
        self.assertEqual(exclamation_fragment("First thought. Second thought! Third thought."), "First thought. Second thought!")
        self.assertEqual(exclamation_fragment("Only an exclamation!"), "Only an exclamation!")
        self.assertEqual(exclamation_fragment("No exclamation here."), None)

    def test_handles_quotes_and_multiline_reasoning(self):
        self.assertEqual(exclamation_fragment('First line.\nI shouted "What!" Next line.'), 'First line. I shouted "What!"')

    def test_ignores_unfinished_reasoning_and_non_reasoning_text(self):
        message = {
            "type": "assistant",
            "time": {},
            "content": [
                {"type": "reasoning", "text": "Not done!"},
                {"type": "reasoning", "text": "This part is complete!", "time": {"completed": 1}},
                {"type": "text", "text": "Reply!"},
                {"type": "tool", "text": "Tool output!"},
            ],
        }
        self.assertEqual(reasoning_fragments(message), ["This part is complete!"])
        self.assertEqual(reasoning_fragments({**message, "type": "u"}), [])
        self.assertEqual(reasoning_fragments({**message, "time": {"completed": 2}}), ["Not done!", "This part is complete!"])

    @patch("extract_unhinged_fragments.api_get")
    def test_retries_truncated_assistant_pages_one_message_at_a_time(self, get):
        get.side_effect = [
            json.JSONDecodeError("truncated", "", 0),
            {"data": [{"id": "msg_1"}], "cursor": {"next": "next page"}},
            {"data": [], "cursor": {}},
        ]
        self.assertEqual(list(pages("/api/session/ses_1/message", message_type="assistant")), [{"id": "msg_1"}])
        self.assertIn("limit=5&type=assistant", get.call_args_list[0].args[0])
        self.assertIn("limit=1&type=assistant", get.call_args_list[1].args[0])
        self.assertIn("cursor=next+page", get.call_args_list[2].args[0])


if __name__ == "__main__":
    unittest.main()
