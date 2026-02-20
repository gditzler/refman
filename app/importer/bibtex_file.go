package importer

import (
	"fmt"
	"os"
	"regexp"
	"strings"

	"antonelli/app/models"
)

// ParseBibtexFile reads a .bib file and returns CreateReferenceInput for each entry.
func ParseBibtexFile(path string) ([]models.CreateReferenceInput, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return ParseBibtex(string(data))
}

// ParseBibtex parses BibTeX content and returns CreateReferenceInput for each entry.
func ParseBibtex(content string) ([]models.CreateReferenceInput, error) {
	var refs []models.CreateReferenceInput

	// Match @type{citekey, ...} entries
	// Simplified: find @\w+{\w+, and then capture until matching }
	re := regexp.MustCompile(`@(\w+)\s*\{\s*([^,]+)\s*,`)
	matches := re.FindAllStringSubmatchIndex(content, -1)

	for i, m := range matches {
		entryType := strings.ToLower(content[m[2]:m[3]])
		citeKey := strings.TrimSpace(content[m[4]:m[5]])

		// Find the start of entry body (first {) and matching closing }
		start := strings.Index(content[m[0]:], "{") + m[0]
		end := findMatchingBrace(content, start)
		if end < 0 {
			continue
		}
		entryBody := content[start+1 : end] // +1 to skip opening {

		// Remove leading citekey, (already captured)
		if comma := strings.Index(entryBody, ","); comma >= 0 {
			entryBody = strings.TrimSpace(entryBody[comma+1:])
		}

		// Parse fields
		fields := parseBibtexFields(entryBody)

		ref := models.CreateReferenceInput{
			EntryType:  mapBibtexEntryType(entryType),
			CiteKey:    citeKey,
			Title:      getField(fields, "title"),
			Authors:    getField(fields, "author"),
			Year:       parseInt(getField(fields, "year")),
			Venue:      getVenueField(fields, entryType),
			Volume:     getField(fields, "volume"),
			Number:     getField(fields, "number"),
			Pages:      getField(fields, "pages"),
			DOI:        getField(fields, "doi"),
			URL:        getField(fields, "url"),
			Abstract:   getField(fields, "abstract"),
			Keywords:   getField(fields, "keywords"),
			Notes:      getField(fields, "note"),
			FromImport: true,
		}
		if ref.Title == "" {
			ref.Title = "(Untitled)"
		}

		refs = append(refs, ref)

		// Update next start to avoid overlapping
		if i+1 < len(matches) {
			// Next match starts at matches[i+1][0]
		}
	}

	return refs, nil
}

func findMatchingBrace(s string, start int) int {
	if start >= len(s) || s[start] != '{' {
		return -1
	}
	depth := 1
	for i := start + 1; i < len(s); i++ {
		switch s[i] {
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return i
			}
		case '"':
			// Skip quoted string
			i++
			for i < len(s) && s[i] != '"' {
				if s[i] == '\\' {
					i++
				}
				i++
			}
		}
	}
	return -1
}

func parseBibtexFields(body string) map[string]string {
	fields := make(map[string]string)
	body = strings.TrimSpace(body)

	for len(body) > 0 {
		// Skip leading comma from previous field
		body = strings.TrimSpace(body)
		if len(body) > 0 && body[0] == ',' {
			body = strings.TrimSpace(body[1:])
		}
		if body == "" {
			break
		}
		// Find key = value
		eq := strings.Index(body, "=")
		if eq < 0 {
			break
		}
		key := strings.TrimSpace(strings.ToLower(body[:eq]))
		body = strings.TrimSpace(body[eq+1:])
		if body == "" {
			break
		}

		var val string
		if body[0] == '{' {
			end := findMatchingBrace(body, 0)
			if end > 0 {
				val = body[1:end]
				body = body[end+1:]
			}
		} else if body[0] == '"' {
			end := strings.Index(body[1:], `"`)
			if end >= 0 {
				val = body[1 : end+1]
				body = body[end+2:]
			}
		} else {
			// Number or unquoted
			end := strings.IndexAny(body, ",\n")
			if end < 0 {
				val = body
				body = ""
			} else {
				val = body[:end]
				body = body[end+1:]
			}
		}

		val = strings.TrimSpace(strings.TrimSuffix(val, ","))
		val = unbrace(val)
		if key != "" {
			fields[key] = val
		}
		body = strings.TrimSpace(body)
	}

	return fields
}

func unbrace(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return s
	}
	if (s[0] == '{' && s[len(s)-1] == '}') || (s[0] == '"' && s[len(s)-1] == '"') {
		return s[1 : len(s)-1]
	}
	return s
}

func getField(fields map[string]string, key string) string {
	if v, ok := fields[key]; ok {
		return strings.TrimSpace(v)
	}
	return ""
}

func getVenueField(fields map[string]string, entryType string) string {
	switch entryType {
	case "article":
		return getField(fields, "journal")
	case "inproceedings", "incollection":
		return getField(fields, "booktitle")
	case "book":
		return getField(fields, "publisher")
	case "phdthesis", "mastersthesis":
		return getField(fields, "school")
	case "techreport":
		return getField(fields, "institution")
	default:
		return getField(fields, "howpublished")
	}
}

func parseInt(s string) int {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	var n int
	_, err := fmt.Sscanf(s, "%d", &n)
	if err != nil {
		return 0
	}
	return n
}

func mapBibtexEntryType(t string) string {
	valid := map[string]bool{
		"article": true, "book": true, "inproceedings": true, "incollection": true,
		"phdthesis": true, "mastersthesis": true, "techreport": true, "misc": true,
	}
	if valid[t] {
		return t
	}
	return "misc"
}
