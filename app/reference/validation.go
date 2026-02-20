package reference

import (
	"fmt"
	"strings"

	"antonelli/app/models"
)

type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func (e ValidationError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Message)
}

type ValidationErrors []ValidationError

func (e ValidationErrors) Error() string {
	var msgs []string
	for _, err := range e {
		msgs = append(msgs, err.Error())
	}
	return strings.Join(msgs, "; ")
}

func ValidateCreate(input models.CreateReferenceInput) ValidationErrors {
	var errors ValidationErrors

	if strings.TrimSpace(input.Title) == "" {
		errors = append(errors, ValidationError{
			Field:   "title",
			Message: "Title is required",
		})
	}

	if strings.TrimSpace(input.EntryType) == "" {
		errors = append(errors, ValidationError{
			Field:   "entryType",
			Message: "Entry type is required",
		})
	} else if !models.IsValidEntryType(input.EntryType) {
		errors = append(errors, ValidationError{
			Field:   "entryType",
			Message: fmt.Sprintf("Invalid entry type. Must be one of: %s", strings.Join(models.ValidEntryTypes, ", ")),
		})
	}

	if input.Year < 0 || input.Year > 9999 {
		errors = append(errors, ValidationError{
			Field:   "year",
			Message: "Year must be between 0 and 9999",
		})
	}

	return errors
}

func ValidateUpdate(input models.UpdateReferenceInput) ValidationErrors {
	var errors ValidationErrors

	if strings.TrimSpace(input.ID) == "" {
		errors = append(errors, ValidationError{
			Field:   "id",
			Message: "ID is required",
		})
	}

	if strings.TrimSpace(input.Title) == "" {
		errors = append(errors, ValidationError{
			Field:   "title",
			Message: "Title is required",
		})
	}

	if strings.TrimSpace(input.EntryType) == "" {
		errors = append(errors, ValidationError{
			Field:   "entryType",
			Message: "Entry type is required",
		})
	} else if !models.IsValidEntryType(input.EntryType) {
		errors = append(errors, ValidationError{
			Field:   "entryType",
			Message: fmt.Sprintf("Invalid entry type. Must be one of: %s", strings.Join(models.ValidEntryTypes, ", ")),
		})
	}

	if input.Year < 0 || input.Year > 9999 {
		errors = append(errors, ValidationError{
			Field:   "year",
			Message: "Year must be between 0 and 9999",
		})
	}

	return errors
}
