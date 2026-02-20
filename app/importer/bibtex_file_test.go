package importer

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseBibtex(t *testing.T) {
	content := `@article{smith2024,
  author = {John Smith and Jane Doe},
  title = {A Sample Article},
  journal = {Journal of Examples},
  year = {2024},
  volume = {10},
  number = {2},
  pages = {1-20},
  doi = {10.1234/example},
  url = {https://example.com},
  abstract = {This is an abstract.},
  keywords = {sample, test}
}

@inproceedings{jones2023,
  author = {Bob Jones},
  title = {Conference Paper Title},
  booktitle = {Proceedings of the Conference},
  year = {2023}
}`
	refs, err := ParseBibtex(content)
	if err != nil {
		t.Fatal(err)
	}
	if len(refs) != 2 {
		t.Fatalf("expected 2 refs, got %d", len(refs))
	}
	if refs[0].CiteKey != "smith2024" {
		t.Errorf("expected citeKey smith2024, got %s", refs[0].CiteKey)
	}
	if refs[0].Title != "A Sample Article" {
		t.Errorf("expected title 'A Sample Article', got %s", refs[0].Title)
	}
	if refs[0].Authors != "John Smith and Jane Doe" {
		t.Errorf("expected authors 'John Smith and Jane Doe', got %s", refs[0].Authors)
	}
	if refs[0].Year != 2024 {
		t.Errorf("expected year 2024, got %d", refs[0].Year)
	}
	if refs[0].Venue != "Journal of Examples" {
		t.Errorf("expected venue 'Journal of Examples', got %s", refs[0].Venue)
	}
	if refs[1].CiteKey != "jones2023" {
		t.Errorf("expected citeKey jones2023, got %s", refs[1].CiteKey)
	}
	if refs[1].Venue != "Proceedings of the Conference" {
		t.Errorf("expected venue 'Proceedings of the Conference', got %s", refs[1].Venue)
	}
}

func TestParseBibtexFields(t *testing.T) {
	// Single line - note: BibTeX often has space after comma
	body1 := `author = {John Smith}, title = {A Sample Article}, year = {2024}`
	fields1 := parseBibtexFields(body1)
	if fields1["author"] != "John Smith" {
		t.Errorf("single line author: got %q", fields1["author"])
	}
	if fields1["title"] != "A Sample Article" {
		t.Errorf("single line title: got %q", fields1["title"])
	}
	if fields1["year"] != "2024" {
		t.Errorf("single line year: got %q", fields1["year"])
	}
	// Multi line
	body2 := `author = {John Smith and Jane Doe},
  title = {A Sample Article},
  journal = {Journal of Examples},
  year = {2024}`
	fields2 := parseBibtexFields(body2)
	if fields2["title"] != "A Sample Article" {
		t.Errorf("multi line title: got %q", fields2["title"])
	}
	if fields2["year"] != "2024" {
		t.Errorf("multi line year: got %q", fields2["year"])
	}
}

func TestParseBibtexFile(t *testing.T) {
	tmp := t.TempDir()
	path := filepath.Join(tmp, "test.bib")
	content := `@article{test2024, title = {Test}, author = {A. B.}, year = {2024}}`
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	refs, err := ParseBibtexFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(refs) != 1 {
		t.Fatalf("expected 1 ref, got %d", len(refs))
	}
	if refs[0].CiteKey != "test2024" {
		t.Errorf("expected citeKey test2024, got %s", refs[0].CiteKey)
	}
}
