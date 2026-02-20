package export

import (
	"fmt"
	"strings"

	"antonelli/app/models"
)

func ToBibtex(ref models.Reference) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("@%s{%s,\n", ref.EntryType, ref.CiteKey))

	if ref.Authors != "" {
		sb.WriteString(fmt.Sprintf("  author    = {%s},\n", ref.Authors))
	}
	if ref.Title != "" {
		sb.WriteString(fmt.Sprintf("  title     = {%s},\n", ref.Title))
	}

	switch ref.EntryType {
	case "article":
		if ref.Venue != "" {
			sb.WriteString(fmt.Sprintf("  journal   = {%s},\n", ref.Venue))
		}
	case "inproceedings", "incollection":
		if ref.Venue != "" {
			sb.WriteString(fmt.Sprintf("  booktitle = {%s},\n", ref.Venue))
		}
	case "book":
		if ref.Venue != "" {
			sb.WriteString(fmt.Sprintf("  publisher = {%s},\n", ref.Venue))
		}
	case "phdthesis", "mastersthesis":
		if ref.Venue != "" {
			sb.WriteString(fmt.Sprintf("  school    = {%s},\n", ref.Venue))
		}
	case "techreport":
		if ref.Venue != "" {
			sb.WriteString(fmt.Sprintf("  institution = {%s},\n", ref.Venue))
		}
	default:
		if ref.Venue != "" {
			sb.WriteString(fmt.Sprintf("  howpublished = {%s},\n", ref.Venue))
		}
	}

	if ref.Year > 0 {
		sb.WriteString(fmt.Sprintf("  year      = {%d},\n", ref.Year))
	}
	if ref.Volume != "" {
		sb.WriteString(fmt.Sprintf("  volume    = {%s},\n", ref.Volume))
	}
	if ref.Number != "" {
		sb.WriteString(fmt.Sprintf("  number    = {%s},\n", ref.Number))
	}
	if ref.Pages != "" {
		sb.WriteString(fmt.Sprintf("  pages     = {%s},\n", ref.Pages))
	}
	if ref.DOI != "" {
		sb.WriteString(fmt.Sprintf("  doi       = {%s},\n", ref.DOI))
	}
	if ref.URL != "" {
		sb.WriteString(fmt.Sprintf("  url       = {%s},\n", ref.URL))
	}
	if ref.Abstract != "" {
		sb.WriteString(fmt.Sprintf("  abstract  = {%s},\n", ref.Abstract))
	}
	if ref.Keywords != "" {
		sb.WriteString(fmt.Sprintf("  keywords  = {%s},\n", ref.Keywords))
	}

	sb.WriteString("}\n")

	return sb.String()
}

func ToBibtexMultiple(refs []models.Reference) string {
	var sb strings.Builder

	for i, ref := range refs {
		sb.WriteString(ToBibtex(ref))
		if i < len(refs)-1 {
			sb.WriteString("\n")
		}
	}

	return sb.String()
}
