# Assignment privacy is enforced by the app, not by encryption

Assignments are stored in a table that no Organizer-facing or Member-facing API returns except a Member's own row. Anyone with direct database access (the developer) could read them. We accepted this for v1 because the audience is friends and family and encryption adds key-management work; the FAQ says so plainly. Encrypting Assignments can be added later without changing the product.
