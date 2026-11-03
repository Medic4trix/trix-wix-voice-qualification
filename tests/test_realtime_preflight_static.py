import pathlib
import unittest

PAGE = pathlib.Path(__file__).resolve().parents[1] / "realtime-preflight.html"


class RealtimePreflightStaticTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")

    def test_network_connections_disabled(self):
        self.assertIn("connect-src 'none'", self.html)
        self.assertIn("default-src 'none'", self.html)

    def test_local_audio_offer_only(self):
        self.assertIn("getUserMedia({audio:true,video:false})", self.html)
        self.assertIn("new RTCPeerConnection({iceServers:[]})", self.html)
        self.assertIn("createOffer()", self.html)
        self.assertIn("LOCAL_AUDIO_OFFER=PASS", self.html)

    def test_no_provider_session_or_remote_signaling(self):
        for prohibited in ("api.openai.com", "fetch(", "XMLHttpRequest", "WebSocket(", "setRemoteDescription(", "Authorization:", "sk-proj-", "sk-"):
            self.assertNotIn(prohibited, self.html)
        self.assertIn("OPENAI_REQUESTS=0", self.html)
        self.assertIn("CANONICAL_AUTHORITY=BLOCKED", self.html)

    def test_resources_closed(self):
        self.assertIn("pc.close()", self.html)
        self.assertIn("getTracks().forEach(t=>t.stop())", self.html)


if __name__ == "__main__":
    unittest.main()
