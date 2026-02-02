# Menu Tab Implementation Instructions

## Updates Needed in `/Users/adil/cofau/frontend/app/profile.tsx`

### 1. Add Menu Fetching Function

Add this function after the `fetchRestaurantReviews` function (around line 540):

```typescript
// Fetch restaurant menu items
const fetchRestaurantMenu = async (restaurantId: string) => {
  try {
    const response = await axios.get(
      `${BACKEND_URL}/api/restaurant/menu/${restaurantId}/public`
    );
    console.log('✅ Menu items fetched:', response.data);
    setMenuItems(response.data.items || []);
  } catch (error: any) {
    console.error('❌ Error fetching menu:', error.response?.data || error.message);
    // Don't show error if menu is just empty (404)
    if (error.response?.status !== 404) {
      setMenuItems([]);
    }
  }
};
```

### 2. Call Menu Fetch in useEffect

Find the `useEffect` that fetches restaurant data (around line 455-498) and add menu fetching:

```typescript
useEffect(() => {
  if (userData) {
    // Reset pagination when switching tabs or user changes
    setCurrentPage(1);
    setUserPosts([]);
    setHasMorePosts(true);
    fetchUserPosts(userData.id, 1);

    // Fetch restaurant-specific data if it's a restaurant profile
    if (isRestaurantProfile || userData.account_type === 'restaurant') {
      fetchRestaurantReviews(userData.id);
      fetchRestaurantMenu(userData.id);  // ← ADD THIS LINE
    }
  }
}, [userData, activeTab]);
```

### 3. Replace the `renderMenuByCategory` Function

**FIND** this function (around line 1776) and **REPLACE** it with this new version that shows dish names and prices:

```typescript
const renderMenuByCategory = () => {
  // Group menu items by category
  const menuByCategory: { [key: string]: any[] } = {};

  menuItems.forEach((item) => {
    const category = item.category || 'Other';
    if (!menuByCategory[category]) {
      menuByCategory[category] = [];
    }
    menuByCategory[category].push(item);
  });

  // Sort categories alphabetically
  const sortedCategories = Object.entries(menuByCategory).sort(
    ([catA], [catB]) => catA.localeCompare(catB)
  );

  if (sortedCategories.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="restaurant-outline" size={64} color="#ccc" />
        <Text style={styles.emptyText}>No menu items yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.favouriteContainer}>
      {sortedCategories.map(([category, items]) => {
        const isExpanded = expandedMenuCategories[category] || false;

        return (
          <View key={category} style={styles.menuCategorySection}>
            {/* Category Header */}
            <TouchableOpacity
              style={styles.menuCategoryHeader}
              onPress={() => toggleMenuCategory(category)}
              activeOpacity={0.7}
            >
              <View style={styles.menuCategoryHeaderLeft}>
                <Ionicons name="restaurant" size={20} color="#FF8C00" />
                <Text style={styles.menuCategoryName}>{category}</Text>
              </View>
              <View style={styles.menuCategoryHeaderRight}>
                <Text style={styles.menuItemCount}>({items.length})</Text>
                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#666"
                />
              </View>
            </TouchableOpacity>

            {/* Menu Items List - Show when expanded */}
            {isExpanded && (
              <View style={styles.menuItemsList}>
                {items.map((item, index) => (
                  <View
                    key={item.id}
                    style={[
                      styles.menuItemRow,
                      index === items.length - 1 && styles.menuItemRowLast
                    ]}
                  >
                    <View style={styles.menuItemInfo}>
                      <Text style={styles.menuItemName}>{item.name}</Text>
                      {item.description && (
                        <Text style={styles.menuItemDescription} numberOfLines={2}>
                          {item.description}
                        </Text>
                      )}
                    </View>
                    {item.price && (
                      <View style={styles.menuItemPriceContainer}>
                        <Text style={styles.menuItemPrice}>₹{item.price}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};
```

### 4. Add New Styles

Add these styles to the `StyleSheet.create` at the bottom of the file (around line 6000+):

```typescript
// Add these to the existing styles object:

  menuCategorySection: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuCategoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuCategoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuCategoryName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginLeft: 10,
  },
  menuCategoryHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuItemCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  menuItemsList: {
    paddingVertical: 8,
  },
  menuItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  menuItemRowLast: {
    borderBottomWidth: 0,
  },
  menuItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  menuItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  menuItemDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  menuItemPriceContainer: {
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE4A0',
  },
  menuItemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF8C00',
  },
```

## Summary of Changes

1. ✅ Added `fetchRestaurantMenu()` function to fetch menu from API
2. ✅ Updated useEffect to call menu fetch when viewing restaurant profile
3. ✅ Replaced `renderMenuByCategory()` to show dish names and prices in list format
4. ✅ Added new styles for menu categories and items

## Result

The Menu tab will now show:
- 📂 **Collapsible categories** (e.g., "Main Course", "Desserts")
- 📝 **Dish names** with descriptions
- 💰 **Prices** in₹ with highlighted badges
- 📊 **Item count** per category
- 🎨 **Clean, modern UI** matching Favourites tab style

---

**All changes are minimal and localized to avoid breaking existing code!**
