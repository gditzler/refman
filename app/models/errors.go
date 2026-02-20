package models

import "encoding/json"

// AppError is a typed error returned by App methods. It encodes itself as JSON
// so the Wails bridge carries structured error info to the frontend.
type AppError struct {
	Code        string `json:"code"`
	Message     string `json:"message"`
	Recoverable bool   `json:"recoverable"`
}

func (e *AppError) Error() string {
	data, _ := json.Marshal(e)
	return string(data)
}

// Error codes used across the app.
const (
	ErrCodeCiteKeyCollision = "CITE_KEY_COLLISION"
	ErrCodeValidation       = "VALIDATION"
	ErrCodeNotFound         = "NOT_FOUND"
	ErrCodeDatabase         = "DATABASE"
	ErrCodeImport           = "IMPORT"
)

func NewAppError(code, message string, recoverable bool) *AppError {
	return &AppError{Code: code, Message: message, Recoverable: recoverable}
}
