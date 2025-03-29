package util

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

// Response structure for the Exchange Rate API
type ExchangeRateResponse struct {
	ConversionRates map[string]float64 `json:"conversion_rates"`
}

func GetExchangeRate() string {
	// Get API key from environment variable
	apiKey := os.Getenv("EXCHANGE_RATE_API_KEY")
	if apiKey == "" {
		return "EXCHANGE_RATE_API_KEY environment variable not set"
	}

	// Where SGD is the base currency
	url := fmt.Sprintf("https://v6.exchangerate-api.com/v6/%s/latest/SGD", apiKey)

	// Making request
	resp, err := http.Get(url)
	if err != nil {
		return fmt.Sprintf("Error making request: %v", err)
	}
	defer resp.Body.Close()

	// Check if request was successful
	if resp.StatusCode != http.StatusOK {
		return fmt.Sprintf("API request failed with status code: %d", resp.StatusCode)
	}

	// Parse response
	var data ExchangeRateResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return fmt.Sprintf("Error parsing response: %v", err)
	}

	// Get SGD to MYR conversion rate
	sgdToMYR, ok := data.ConversionRates["MYR"]
	if !ok {
		return "MYR conversion rate not found"
	}

	return fmt.Sprintf("Conversion rates of SGD to MYR today is %.2f", sgdToMYR)
}
