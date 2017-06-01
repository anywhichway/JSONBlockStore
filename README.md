# JSONBlockStore
Single file, block allocated storage for JSON objects.

Objects are retrievable by key or line number.

Reads over 100,000 objects second for small size records, i.e. 100 bytes.

Writes over 25,000 objects second for small size records, i.e. 100 bytes.
