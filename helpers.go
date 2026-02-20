package main

import "os"

func writeFile(filepath string, content string) error {
	return os.WriteFile(filepath, []byte(content), 0644)
}

func writeFileBytes(filepath string, content []byte) error {
	return os.WriteFile(filepath, content, 0644)
}
