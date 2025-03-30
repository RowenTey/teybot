package util

// TaskMap is a global map of task names to their corresponding functions
// Each function should return a string, which is the message to be sent
var TaskMap = map[string]func() string{
	"SGD_TO_MYR": GetExchangeRate,
	// Add more tasks here as needed
}
