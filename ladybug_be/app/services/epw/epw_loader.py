"""EPW soubor loader - načítá a validuje EPW data."""
import os
from typing import Optional
from ladybug.epw import EPW
from ladybug.location import Location


class EPWLoader:
    """Načítá a validuje EPW soubory."""
    
    def __init__(self, epw_path: str):
        self.epw_path = epw_path
        self.epw_data: Optional[EPW] = None
        self.location: Optional[Location] = None
    
    def load(self) -> EPW:
        """Načte EPW data."""
        if not os.path.exists(self.epw_path):
            raise FileNotFoundError(f"EPW soubor nenalezen: {self.epw_path}")
        
        self.epw_data = EPW(self.epw_path)
        self.location = self.epw_data.location
        return self.epw_data
    
    def get_location_info(self) -> dict:
        """Vrátí informace o lokaci."""
        if not self.location:
            raise ValueError("EPW data nebyla načtena")
        
        return {
            "city": self.location.city,
            "country": self.location.country,
            "latitude": round(self.location.latitude, 3),
            "longitude": round(self.location.longitude, 3),
            "elevation": round(self.location.elevation, 1),
            "timezone": self.location.time_zone
        }