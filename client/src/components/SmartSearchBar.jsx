import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000/api';

export default function SmartSearchBar({ onSearchResults, selectedCategory }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [didYouMean, setDidYouMean] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Perform fuzzy search
  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.trim().length === 0) {
      onSearchResults([], false);
      setSuggestions([]);
      setDidYouMean(null);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await axios.get(`${API}/provider/products/search`, {
        params: { q: searchQuery.trim() }
      });
      
      const data = res.data;
      let results = data.products || [];

      // Apply category filter client-side if set
      if (selectedCategory) {
        results = results.filter(p => p.category === selectedCategory);
      }

      onSearchResults(results, true);
      setSuggestions(data.suggestions || []);
      setDidYouMean(data.didYouMean || null);
      setHasSearched(true);
    } catch (err) {
      console.error('Search failed:', err);
      onSearchResults([], true);
    } finally {
      setIsSearching(false);
    }
  }, [onSearchResults, selectedCategory]);

  // Debounced search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      onSearchResults([], false);
      setSuggestions([]);
      setDidYouMean(null);
      setHasSearched(false);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, performSearch]);

  // Re-search when category changes
  useEffect(() => {
    if (query.trim()) {
      performSearch(query);
    }
  }, [selectedCategory]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        performSearch(query);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          selectSuggestion(suggestions[activeIndex]);
        } else {
          performSearch(query);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  const selectSuggestion = (suggestion) => {
    setQuery(suggestion);
    setIsOpen(false);
    setActiveIndex(-1);
    performSearch(suggestion);
  };

  const handleDidYouMean = () => {
    if (didYouMean) {
      setQuery(didYouMean);
      performSearch(didYouMean);
      setDidYouMean(null);
    }
  };

  // Highlight matching parts of suggestions
  const highlightMatch = (text, query) => {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <strong className="search-highlight">{text.slice(idx, idx + query.length)}</strong>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <div className="smart-search-wrapper" ref={wrapperRef}>
      <div className={`smart-search-bar ${isOpen && suggestions.length > 0 ? 'has-suggestions' : ''}`}>
        <span className="smart-search-icon">
          {isSearching ? (
            <span className="search-spinner"></span>
          ) : (
            '🔍'
          )}
        </span>
        <input
          ref={inputRef}
          className="smart-search-input"
          type="text"
          placeholder="Search products, parts, brands... (typos OK!)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck="false"
        />
        {query && (
          <button 
            className="smart-search-clear" 
            onClick={() => {
              setQuery('');
              setSuggestions([]);
              setDidYouMean(null);
              setIsOpen(false);
              setHasSearched(false);
              onSearchResults([], false);
              inputRef.current?.focus();
            }}
            title="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="search-suggestions-dropdown">
          {suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              className={`search-suggestion-item ${idx === activeIndex ? 'active' : ''}`}
              onClick={() => selectSuggestion(suggestion)}
              onMouseEnter={() => setActiveIndex(idx)}
            >
              <span className="suggestion-icon">🔎</span>
              <span className="suggestion-text">{highlightMatch(suggestion, query)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Did You Mean */}
      {didYouMean && hasSearched && (
        <div className="did-you-mean">
          <span>Did you mean: </span>
          <button className="did-you-mean-link" onClick={handleDidYouMean}>
            {didYouMean}
          </button>
          <span>?</span>
        </div>
      )}
    </div>
  );
}
