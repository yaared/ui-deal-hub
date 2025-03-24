import { useState, useEffect, useRef } from 'react';
import styles from './SearchBar.module.css';

const API_URL = 'https://web-production-95ea.up.railway.app';

interface AskResponse {
  answer: string;
  sources: {
    text: string;
    score: number;
    metadata: Record<string, any>;
  }[];
}

interface AskState {
  isLoading: boolean;
  answer: string | null;
  sources: AskResponse['sources'] | null;
  error: string | null;
}

export default function SearchBar() {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [dealQuery, setDealQuery] = useState('');
  const [sessionId] = useState(() => crypto.randomUUID());
  const [selectedDeals, setSelectedDeals] = useState<string[]>([]);
  const [deals, setDeals] = useState<string[]>([]);
  const [_isLoadingDeals, setIsLoadingDeals] = useState(true);
  const [_dealsError, setDealsError] = useState<string | null>(null);
  const [highlightedDeal, setHighlightedDeal] = useState<number>(-1);
  const [askResult, setAskResult] = useState<AskState>({
    isLoading: false,
    answer: null,
    sources: null,
    error: null
  });
  const [isAskMode, setIsAskMode] = useState(false);

  // Filter deals based on query
  const filteredDeals = deals.filter(deal => 
    deal.toLowerCase().includes(dealQuery.toLowerCase())
  );

  useEffect(() => {
    // Fetch available deals when component mounts
    const fetchDeals = async () => {
      try {
        setIsLoadingDeals(true);
        setDealsError(null);
        console.log('Fetching deals from:', `${API_URL}/deals`);
        const response = await fetch(`${API_URL}/deals`);
        if (!response.ok) throw new Error('Failed to fetch deals');
        const data = await response.json();
        console.log('Received deals:', data);
        setDeals(data.deals);
      } catch (error) {
        console.error('Error fetching deals:', error);
        setDealsError(error instanceof Error ? error.message : 'Failed to fetch deals');
      } finally {
        setIsLoadingDeals(false);
      }
    };
    fetchDeals();
  }, []);

  const handleDealKeyDown = (e: React.KeyboardEvent) => {
    if (!filteredDeals.length) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (highlightedDeal < filteredDeals.length - 1) {
          const newIndex = highlightedDeal + 1;
          setHighlightedDeal(newIndex);
          
          // Ensure the newly highlighted item is visible
          const dropdown = dropdownRef.current;
          const highlightedElement = dropdown?.querySelector(`[data-index="${newIndex}"]`);
          
          if (dropdown && highlightedElement) {
            const dropdownRect = dropdown.getBoundingClientRect();
            const elementRect = highlightedElement.getBoundingClientRect();
            
            if (elementRect.bottom > dropdownRect.bottom) {
              highlightedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          }
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (highlightedDeal > 0) {
          const newIndex = highlightedDeal - 1;
          setHighlightedDeal(newIndex);
          
          // Ensure the newly highlighted item is visible
          const dropdown = dropdownRef.current;
          const highlightedElement = dropdown?.querySelector(`[data-index="${newIndex}"]`);
          
          if (dropdown && highlightedElement) {
            const dropdownRect = dropdown.getBoundingClientRect();
            const elementRect = highlightedElement.getBoundingClientRect();
            
            if (elementRect.top < dropdownRect.top) {
              highlightedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          }
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredDeals[highlightedDeal]) {
          selectDeal(filteredDeals[highlightedDeal]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setDealQuery('');
        break;
    }
  };

  const selectDeal = async (dealName: string) => {
    try {
      // Toggle deal selection
      const newSelectedDeals = selectedDeals.includes(dealName)
        ? selectedDeals.filter(deal => deal !== dealName)
        : [...selectedDeals, dealName];

      const response = await fetch(`${API_URL}/select-deals/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deals: newSelectedDeals })
      });
      
      if (!response.ok) throw new Error('Failed to select deals');
      setSelectedDeals(newSelectedDeals);
      
      // Only reset query and results if we have no deals selected
      if (newSelectedDeals.length === 0) {
        setQuery('');
        setAskResult({
          isLoading: false,
          answer: null,
          sources: null,
          error: null
        });
      }
    } catch (error) {
      console.error('Error selecting deals:', error);
    }
  };

  const askQuestion = async (question: string) => {
    if (selectedDeals.length === 0) return;
    
    try {
      setAskResult({
        isLoading: true,
        answer: null,
        sources: null,
        error: null
      });
      
      const response = await fetch(`${API_URL}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          question: question,
          session_id: sessionId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get answer');
      }

      const data: AskResponse = await response.json();
      setAskResult({
        isLoading: false,
        answer: data.answer,
        sources: data.sources,
        error: null
      });
    } catch (error) {
      setAskResult({
        isLoading: false,
        answer: null,
        sources: null,
        error: error instanceof Error ? error.message : 'Failed to get answer'
      });
    }
  };

  // Add this helper function
  const getUniqueSourcesByFilename = (sources: AskResponse['sources']) => {
    if (!sources) return [];
    
    // Create a map to store the highest scoring source for each filename
    const filenameMap = new Map();
    
    sources.forEach(source => {
      const filename = source.metadata.name;
      if (!filename) return;
      
      // If we haven't seen this filename, or if this source has a higher score
      if (!filenameMap.has(filename) || source.score > filenameMap.get(filename).score) {
        filenameMap.set(filename, source);
      }
    });
    
    // Convert map back to array and sort by score descending
    return Array.from(filenameMap.values()).sort((a, b) => b.score - a.score);
  };

  const clearDeals = () => {
    setSelectedDeals([]);
    setQuery('');
    setAskResult({
      isLoading: false,
      answer: null,
      sources: null,
      error: null
    });
  };

  return (
    <div className={styles.searchContainer}>
      <div className={styles.searchWrapper}>
        <div className={styles.dealSelectionContainer}>
          <div className={styles.inputContainer}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder={isAskMode 
                ? `Ask a question about ${selectedDeals.length === 1 ? 'this deal' : 'these deals'}...`
                : "Which deals do you want to talk about..."
              }
              value={isAskMode ? query : dealQuery}
              onChange={(e) => {
                if (isAskMode) {
                  setQuery(e.target.value);
                } else {
                  setDealQuery(e.target.value);
                  setHighlightedDeal(0);
                }
              }}
              onKeyDown={(e) => {
                if (isAskMode) {
                  if (e.key === 'Enter' && query.trim()) {
                    e.preventDefault();
                    askQuestion(query.trim());
                  } else if (e.key === 'Escape') {
                    setIsAskMode(false);
                    setQuery('');
                  }
                } else {
                  handleDealKeyDown(e);
                }
              }}
            />

            {selectedDeals.length > 0 && (
              <button
                className={styles.askButton}
                onClick={() => {
                  setIsAskMode(!isAskMode);
                  if (isAskMode) {
                    setQuery('');  // Clear question when switching to select mode
                  } else {
                    setDealQuery('');  // Clear deal search when switching to ask mode
                  }
                }}
              >
                {isAskMode ? 'Select deals' : 'Ask'}
              </button>
            )}
          </div>

          {/* Only show dropdown when not in ask mode */}
          {!isAskMode && (
            <div className={styles.dealsDropdown} ref={dropdownRef}>
              {filteredDeals.length === 0 ? (
                <div className={styles.dealsEmpty}>
                  {dealQuery ? 'No matching deals found' : 'Start typing to search deals'}
                </div>
              ) : (
                filteredDeals.map((deal, index) => (
                  <div
                    key={deal}
                    data-index={index}
                    className={`${styles.dealOption} 
                      ${index === highlightedDeal ? styles.highlighted : ''} 
                      ${selectedDeals.includes(deal) ? styles.selected : ''}`}
                    onClick={() => selectDeal(deal)}
                  >
                    {deal}
                    {selectedDeals.includes(deal) && <span className={styles.checkmark}>✓</span>}
                  </div>
                ))
              )}
            </div>
          )}

          {selectedDeals.length > 0 && (
            <div className={styles.selectedDeals}>
              {selectedDeals.map(deal => (
                <div key={deal} className={styles.selectedDealTag}>
                  <span>{deal}</span>
                  {/* Only show remove button if we're not in ask mode OR if it's not the last deal */}
                  {(!isAskMode || selectedDeals.length > 1) && (
                    <button 
                      className={styles.removeDealButton}
                      onClick={() => selectDeal(deal)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {/* Only show Clear All button in select mode */}
              {!isAskMode && (
                <button 
                  className={styles.clearDealsButton}
                  onClick={clearDeals}
                >
                  Clear All
                </button>
              )}
            </div>
          )}
        </div>

        {/* Results container */}
        {isAskMode && (
          <div className={styles.resultsContainer}>
            {askResult.isLoading ? (
              <div className={styles.contentContainer}>
                <div className={styles.answerLoading}>
                  Thinking...
                </div>
              </div>
            ) : askResult.error ? (
              <div className={styles.contentContainer}>
                <div className={`${styles.answerPanel} ${styles.hasContent}`}>
                  <div className={styles.answerError}>
                    {askResult.error}
                  </div>
                </div>
              </div>
            ) : askResult.answer ? (
              <div className={styles.contentContainer}>
                <div className={`${styles.answerPanel} ${styles.hasContent}`}>
                  <div className={styles.answer}>
                    <h3>Answer</h3>
                    <p>{askResult.answer}</p>
                  </div>
                </div>
                {askResult.sources && (
                  <div className={styles.sourcesPanel}>
                    <h4>Sources ({getUniqueSourcesByFilename(askResult.sources).length})</h4>
                    <div className={styles.sourcesList}>
                      {getUniqueSourcesByFilename(askResult.sources).map((source, index) => (
                        <div key={index} className={styles.source}>
                          <div className={styles.metadataItem}>
                            <span className={styles.metadataLabel}>Name:</span>
                            <span className={styles.metadataValue}>{source.metadata.name || 'Unknown'}</span>
                          </div>
                          <div className={styles.metadataGrid}>
                            <div className={styles.metadataItem}>
                              <span className={styles.metadataLabel}>Size:</span>
                              <span className={styles.metadataValue}>{source.metadata.size || 'Unknown'}</span>
                            </div>
                            <div className={styles.metadataItem}>
                              <span className={styles.metadataLabel}>Score:</span>
                              <span className={`${styles.metadataValue} ${styles.score}`}>{Math.round(source.score * 100)}%</span>
                            </div>
                          </div>
                          <div className={styles.metadataGrid}>
                            <div className={styles.metadataItem}>
                              <span className={styles.metadataLabel}>By:</span>
                              <span className={styles.metadataValue}>{source.metadata.author || 'Unknown'}</span>
                            </div>
                            <div className={styles.metadataItem}>
                              <span className={styles.metadataLabel}>Date:</span>
                              <span className={styles.metadataValue}>
                                {source.metadata.date_created 
                                  ? new Date(source.metadata.date_created).toLocaleDateString()
                                  : 'Unknown'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
} 