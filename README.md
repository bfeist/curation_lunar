# Lunar Curation website reconstruction

Reverse engineering the content of NASA's current public Lunar Curation website for a new React implementation. Python acquisition lives in `/python`; the future React project will live at the root with source under `/src`.

- [Project plan](docs/lunar-data-extraction-plan.md)
- [Python extractor and uv commands](python/README.md)
- [Pilot results](docs/pilot-results.md)
- [Schema evolution and original-source audit](docs/schema-evolution.md)

All Python work uses `uv`. The acquired schema models the public website and can evolve as original code/database information becomes available. API/search discrepancies are retained for a separate audit and treated as legacy search bugs rather than reproduced as hidden restrictions.
