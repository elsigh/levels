import os
import sys
import unittest

from uuid import UUID, uuid4

sys.path.insert(0, os.path.abspath(__file__ + "/../.."))
from shortuuid.main import *


class LegacyShortUUIDTest(unittest.TestCase):
    def test_generation(self):
        self.assertTrue(20 < len(uuid()), 24)
        self.assertTrue(20 < len(uuid("http://www.example.com/")) < 24)
        self.assertTrue(20 < len(uuid("HTTP://www.example.com/")) < 24)
        self.assertTrue(20 < len(uuid("example.com/")) < 24)

    def test_encoding(self):
        u = UUID('{12345678-1234-5678-1234-567812345678}')
        self.assertEquals(encode(u), "VoVuUtBhZ6TvQSAYEqNdF5")

    def test_decoding(self):
        u = UUID('{12345678-1234-5678-1234-567812345678}')
        self.assertEquals(decode("VoVuUtBhZ6TvQSAYEqNdF5"), u)

    def test_alphabet(self):
        backup_alphabet = get_alphabet()

        alphabet = "01"
        set_alphabet(alphabet)
        self.assertEquals(alphabet, get_alphabet())

        set_alphabet("01010101010101")
        self.assertEquals(alphabet, get_alphabet())

        self.assertEquals(set(uuid()), set("01"))
        self.assertTrue(116 < len(uuid()) < 140)

        u = uuid4()
        self.assertEquals(u, decode(encode(u)))

        u = uuid()
        self.assertEquals(u, encode(decode(u)))

        self.assertRaises(ValueError, set_alphabet, "1")
        self.assertRaises(ValueError, set_alphabet, "1111111")

        set_alphabet(backup_alphabet)


class ClassShortUUIDTest(unittest.TestCase):
    def test_generation(self):
        su = ShortUUID()
        self.assertTrue(20 < len(su.uuid()) < 24)
        self.assertTrue(20 < len(su.uuid("http://www.example.com/")) < 24)
        self.assertTrue(20 < len(su.uuid("HTTP://www.example.com/")) < 24)
        self.assertTrue(20 < len(su.uuid("example.com/")) < 24)

    def test_encoding(self):
        su = ShortUUID()
        u = UUID('{12345678-1234-5678-1234-567812345678}')
        self.assertEquals(su.encode(u), "VoVuUtBhZ6TvQSAYEqNdF5")

    def test_decoding(self):
        su = ShortUUID()
        u = UUID('{12345678-1234-5678-1234-567812345678}')
        self.assertEquals(su.decode("VoVuUtBhZ6TvQSAYEqNdF5"), u)

    def test_alphabet(self):
        alphabet = "01"
        su1 = ShortUUID(alphabet)
        su2 = ShortUUID()

        self.assertEquals(alphabet, su1.get_alphabet())

        su1.set_alphabet("01010101010101")
        self.assertEquals(alphabet, su1.get_alphabet())

        self.assertEquals(set(su1.uuid()), set("01"))
        self.assertTrue(116 < len(su1.uuid()) < 140)
        self.assertTrue(20 < len(su2.uuid()) < 24)

        u = uuid4()
        self.assertEquals(u, su1.decode(su1.encode(u)))

        u = su1.uuid()
        self.assertEquals(u, su1.encode(su1.decode(u)))

        self.assertRaises(ValueError, su1.set_alphabet, "1")
        self.assertRaises(ValueError, su1.set_alphabet, "1111111")


if __name__ == '__main__':
    unittest.main()
