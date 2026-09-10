# Recording exports

Recordings stay as raw local evidence. Use **Export shareable copy** from replay library before sending a recording to another person.

Shareable export masks URLs and request or response bodies by default, replaces common credential headers, excludes console and database tracks, and removes DOM replay unless you explicitly keep it. Preview shows redaction counts and excluded tracks. Any sanitization error blocks export; Capubridge never falls back to copying raw data.

Automatic redaction does not guarantee anonymization. Labels, uncommon headers, identifiers, custom fields, retained DOM data, and application-specific values may still identify a person or expose sensitive context. Review resulting archive before sharing it.

**Export raw data** creates an unchanged copy. Use it only when recipient is authorized to access captured credentials, page content, console output, storage data, and device metadata.

Incomplete sessions remain visible in replay library. They identify known missing tracks and can reopen or export available evidence. Deleting one requires explicit **Delete session** action.
