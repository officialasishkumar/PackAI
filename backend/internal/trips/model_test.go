package trips

import "testing"

func TestPrepareItemsNormalizesValues(t *testing.T) {
	t.Parallel()

	items, err := PrepareItems([]TripItem{
		{
			Name:     " MacBook Air ",
			Category: "technology",
			Quantity: 0,
			AddedBy:  "",
		},
	})
	if err != nil {
		t.Fatalf("PrepareItems() error = %v", err)
	}

	if len(items) != 1 {
		t.Fatalf("PrepareItems() len = %d", len(items))
	}
	if items[0].ItemID == "" {
		t.Fatal("PrepareItems() expected generated item id")
	}
	if items[0].Category != CategoryElectronics {
		t.Fatalf("PrepareItems() category = %q", items[0].Category)
	}
	if items[0].Quantity != 1 {
		t.Fatalf("PrepareItems() quantity = %d", items[0].Quantity)
	}
	if items[0].AddedBy != AddedByManual {
		t.Fatalf("PrepareItems() added_by = %q", items[0].AddedBy)
	}
}

func TestPrepareItemsRejectsBlankNames(t *testing.T) {
	t.Parallel()

	if _, err := PrepareItems([]TripItem{{Name: "   "}}); err == nil {
		t.Fatal("PrepareItems() expected validation error for blank name")
	}
}

func TestPrepareItemsRejectsTooManyItems(t *testing.T) {
	t.Parallel()

	items := make([]TripItem, 0, MaxTripItems+1)
	for index := 0; index < MaxTripItems+1; index++ {
		items = append(items, TripItem{Name: "Item"})
	}

	if _, err := PrepareItems(items); err == nil {
		t.Fatal("PrepareItems() expected validation error for oversized item list")
	}
}

func TestDeriveStatusCompletesWhenEverythingChecked(t *testing.T) {
	t.Parallel()

	status := DeriveStatus(StatusRepacking, []TripItem{
		{IsPackedForReturn: true},
		{IsPackedForReturn: true},
	})

	if status != StatusCompleted {
		t.Fatalf("DeriveStatus() = %q", status)
	}
}

func TestDeriveStatusPromotesToRepackingWhenAnyItemChecked(t *testing.T) {
	t.Parallel()

	status := DeriveStatus(StatusPacking, []TripItem{
		{IsPackedForReturn: false},
		{IsPackedForReturn: true},
	})

	if status != StatusRepacking {
		t.Fatalf("DeriveStatus() = %q", status)
	}
}
