package util

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

// Response structure for the FinnHub Stock Price API
type StockPriceResponse struct {
	CurrentPrice  float64 `json:"c"`  // Current price
	Change        float64 `json:"d"`  // Change
	PercentChange float64 `json:"dp"` // Percent change
	HighPrice     float64 `json:"h"`  // High price of the day
	LowPrice      float64 `json:"l"`  // Low price of the day
	OpenPrice     float64 `json:"o"`  // Open price of the day
	PreviousClose float64 `json:"pc"` // Previous close price
}

func GetTSLAPrice() string {
	apiKey := os.Getenv("FINNHUB_API_KEY")
	if apiKey == "" {
		return "FINNHUB_API_KEY environment variable not set"
	}

	url := fmt.Sprintf("https://finnhub.io/api/v1/quote?symbol=TSLA&token=%s", apiKey)

	resp, err := http.Get(url)
	if err != nil {
		return fmt.Sprintf("Error making request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Sprintf("API request failed with status code: %d", resp.StatusCode)
	}

	var data StockPriceResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return fmt.Sprintf("Error parsing response: %v", err)
	}

	return fmt.Sprintf("Current Price of TSLA today is $%.4f (USD)", data.CurrentPrice)
}
