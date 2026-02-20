package models

import "time"

type Tag struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Color     string    `json:"color"`
	CreatedAt time.Time `json:"createdAt"`
}

type Folder struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"createdAt"`
}

type ReferenceLink struct {
	ID          string `json:"id"`
	ReferenceID string `json:"referenceId"`
	Label       string `json:"label"`
	URL         string `json:"url"`
}

type Reference struct {
	ID        string    `json:"id"`
	EntryType string    `json:"entryType"`
	CiteKey   string    `json:"citeKey"`
	Title     string    `json:"title"`
	Authors   string    `json:"authors"`
	Year      int       `json:"year"`
	Venue     string    `json:"venue"`
	Volume    string    `json:"volume"`
	Number    string    `json:"number"`
	Pages     string    `json:"pages"`
	DOI       string    `json:"doi"`
	URL       string    `json:"url"`
	Abstract  string    `json:"abstract"`
	Keywords  string    `json:"keywords"`
	Notes       string           `json:"notes"`
	RawBibtex   string           `json:"rawBibtex"`
	GitHubURL   string           `json:"githubUrl"`
	CreatedAt   time.Time        `json:"createdAt"`
	UpdatedAt   time.Time        `json:"updatedAt"`
	ImportedAt  *time.Time       `json:"importedAt,omitempty"`
	Tags        []Tag            `json:"tags"`
	Folders     []Folder         `json:"folders"`
	Links       []ReferenceLink  `json:"links"`
}

type CreateReferenceInput struct {
	EntryType string   `json:"entryType"`
	CiteKey   string   `json:"citeKey"`
	Title     string   `json:"title"`
	Authors   string   `json:"authors"`
	Year      int      `json:"year"`
	Venue     string   `json:"venue"`
	Volume    string   `json:"volume"`
	Number    string   `json:"number"`
	Pages     string   `json:"pages"`
	DOI       string   `json:"doi"`
	URL       string   `json:"url"`
	Abstract  string   `json:"abstract"`
	Keywords  string   `json:"keywords"`
	Notes     string   `json:"notes"`
	Tags      []string `json:"tags"`
	Folders   []string `json:"folders"`
	GitHubURL string   `json:"githubUrl"`
	Links     []LinkInput `json:"links"`
	FromImport bool    `json:"fromImport"`
}

type LinkInput struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

type UpdateReferenceInput struct {
	ID        string   `json:"id"`
	EntryType string   `json:"entryType"`
	CiteKey   string   `json:"citeKey"`
	Title     string   `json:"title"`
	Authors   string   `json:"authors"`
	Year      int      `json:"year"`
	Venue     string   `json:"venue"`
	Volume    string   `json:"volume"`
	Number    string   `json:"number"`
	Pages     string   `json:"pages"`
	DOI       string   `json:"doi"`
	URL       string   `json:"url"`
	Abstract  string   `json:"abstract"`
	Keywords  string   `json:"keywords"`
	Notes     string       `json:"notes"`
	Tags      []string     `json:"tags"`
	Folders   []string     `json:"folders"`
	GitHubURL string       `json:"githubUrl"`
	Links     []LinkInput  `json:"links"`
}

var ValidEntryTypes = []string{
	"article",
	"book",
	"inproceedings",
	"incollection",
	"phdthesis",
	"mastersthesis",
	"techreport",
	"misc",
}

func IsValidEntryType(entryType string) bool {
	for _, valid := range ValidEntryTypes {
		if valid == entryType {
			return true
		}
	}
	return false
}
