import unicodedata


def key(text):
    return " ".join(unicodedata.normalize("NFKC", text).casefold().split())


class ProjectMemory:
    def __init__(self, project, limit=80):
        self.project, self.limit, self.notes, self.revision = project, limit, [], 0
        self.pending = None

    def propose(self, project, note):
        if project != self.project:
            raise PermissionError("wrong project")
        if not note.strip():
            raise ValueError("empty note")
        if any(key(note) == key(existing) for existing in self.notes):
            raise ValueError("duplicate")
        if len("\n".join([*self.notes, note]).encode("utf-8")) > self.limit:
            raise ValueError("memory size exceeded")
        self.pending = (self.revision, note)

    def reject(self):
        self.pending = None

    def approve(self):
        if self.pending is None:
            raise ValueError("no pending proposal")
        revision, note = self.pending
        if revision != self.revision:
            raise RuntimeError("stale proposal")
        self.notes.append(note)
        self.revision += 1
        self.pending = None


def throws(error, function, *args):
    try:
        function(*args)
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")


def main():
    memory = ProjectMemory("alpha")
    throws(PermissionError, memory.propose, "beta", "wrong project")
    assert memory.notes == []
    memory.propose("alpha", "Learning Python")
    assert memory.notes == []
    memory.reject()
    throws(ValueError, memory.approve)
    assert memory.notes == []
    memory.propose("alpha", "Learning Python")
    memory.approve()
    assert memory.notes == ["Learning Python"]
    throws(ValueError, memory.propose, "alpha", "  LEARNING    PYTHON  ")
    throws(ValueError, memory.propose, "alpha", "😊" * 20)
    memory.propose("alpha", "Next: practice functions")
    memory.revision += 1  # Simulate an intervening edit to the project.
    throws(RuntimeError, memory.approve)
    assert memory.notes == ["Learning Python"]
    memory.reject()
    memory.propose("alpha", "Studying Python")
    print("PASS: project check, proposal/rejection, approval, normalized duplicate, UTF-8 byte limit, stale-write check")
    print("LIMIT: 'Studying Python' was accepted as distinct from 'Learning Python'; exact normalization does not detect semantic overlap")


if __name__ == "__main__":
    main()
