import os
import sys
import unittest
from datetime import date

sys.path.insert(0, os.path.dirname(__file__))
from routes.assistant import _local_answer


class LocalAssistantTest(unittest.TestCase):
    def setUp(self):
        self.user = type('User', (), {'shop_name': 'Test Pasal'})()
        # Product objects with attributes used in _local_answer
        self.products = [
            type('Product', (), {
                'name': 'Wai Wai',
                'quantity': 2,
                'low_stock_limit': 5,
                'selling_price': 20,
                'buying_price': 16,
                'expiry_date': None,
                'brand': 'Wai Wai',
                'shelf_number': 'A1',
                'description': ''
            })(),
            type('Product', (), {
                'name': 'Milk',
                'quantity': 12,
                'low_stock_limit': 4,
                'selling_price': 100,
                'buying_price': 85,
                'expiry_date': date(2026, 10, 1),
                'brand': 'MilkBrand',
                'shelf_number': 'B2',
                'description': ''
            })()
        ]
        self.sales_today = (500.0, 80.0, 3)  # total, profit, count
        self.sales_week = (2000.0, 350.0)
        self.pending = [('Ram', 450.0)]

    def test_finds_named_product(self):
        answer = _local_answer("find wai wai", self.user, self.products, self.sales_today, self.sales_week, self.pending)
        self.assertIn("Wai Wai", answer)
        self.assertIn("Rs.20", answer)

    def test_answers_low_stock(self):
        answer = _local_answer("what is running low", self.user, self.products, self.sales_today, self.sales_week, self.pending)
        self.assertIn("Wai Wai", answer)
        self.assertNotIn("Milk", answer)

    def test_answers_today_profit(self):
        answer = _local_answer("today profit", self.user, self.products, self.sales_today, self.sales_week, self.pending)
        self.assertIn("Rs.80", answer)

    def test_answers_unpaid_customers(self):
        answer = _local_answer("show pending khata", self.user, self.products, self.sales_today, self.sales_week, self.pending)
        self.assertIn("Ram", answer)


if __name__ == "__main__":
    unittest.main()