"""ETL failure-boundary checks; no downloads or CSV cache required."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import build_db


class BuildDatabaseTests(unittest.TestCase):
    def test_evolution_depth_handles_out_of_order_babies_and_branches(self):
        rows = [
            {"id": "26", "evolves_from_species_id": "25"},
            {"id": "700", "evolves_from_species_id": "133"},
            {"id": "25", "evolves_from_species_id": "172"},
            {"id": "134", "evolves_from_species_id": "133"},
            {"id": "172", "evolves_from_species_id": ""},
            {"id": "133", "evolves_from_species_id": ""},
        ]
        self.assertEqual(build_db.evolution_metadata(rows), {
            "26": (3, 0), "700": (2, 0), "25": (2, 1),
            "134": (2, 0), "172": (1, 1), "133": (1, 1),
        })

    def test_bad_evolution_links_fail_instead_of_inventing_a_stage(self):
        with self.assertRaisesRegex(ValueError, "Evolution cycle"):
            build_db.evolution_metadata([
                {"id": "1", "evolves_from_species_id": "2"},
                {"id": "2", "evolves_from_species_id": "1"},
            ])
        with self.assertRaises(KeyError):
            build_db.evolution_metadata([{"id": "1", "evolves_from_species_id": "999"}])

    def test_invalid_build_preserves_the_previous_artifact_and_cleans_partial_file(self):
        def broken_build(connection):
            connection.executescript("""
                CREATE TABLE parent (id INTEGER PRIMARY KEY);
                CREATE TABLE child (parent_id REFERENCES parent(id));
                INSERT INTO child VALUES (42);
            """)

        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "pokemon.sqlite"
            target.write_bytes(b"previous artifact")
            with patch.object(build_db, "DB_PATH", target), patch.object(build_db, "populate_database", broken_build):
                with self.assertRaisesRegex(ValueError, "broken foreign keys"):
                    build_db.build()
            self.assertEqual(target.read_bytes(), b"previous artifact")
            self.assertFalse(target.with_suffix(".sqlite.part").exists())


if __name__ == "__main__":
    unittest.main()
