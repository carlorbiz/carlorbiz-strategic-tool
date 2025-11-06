/**
 * RWAV Workshop AI Chatbot
 * OpenAI GPT-4.1-mini integration with SWOT analysis and web search
 * Australian English spelling throughout
 */

class RWAVChatbot {
  constructor(strategicPlanData) {
    this.strategicPlanData = strategicPlanData;
    this.conversationHistory = [];
    this.swotMatrix = {
      strengths: [],
      weaknesses: [],
      opportunities: [],
      threats: []
    };
    
    // Check if OpenAI API key is available
    this.apiKey = this.getAPIKey();
    this.apiEndpoint = 'https://api.openai.com/v1/chat/completions';
    this.model = 'gpt-4.1-mini';
  }
  
  /**
   * Get OpenAI API key from environment or configuration
   */
  getAPIKey() {
    // In production, this would be securely configured
    // For now, we'll use a placeholder that needs to be set
    return localStorage.getItem('openai_api_key') || null;
  }
  
  /**
   * Initialize chatbot with strategic plan context
   */
  async initialize() {
    const systemPrompt = this.buildSystemPrompt();
    this.conversationHistory.push({
      role: 'system',
      content: systemPrompt
    });
    
    return {
      ready: true,
      message: 'AI Chatbot initialized with RWAV Strategic Plan context'
    };
  }
  
  /**
   * Build comprehensive system prompt with strategic plan context
   */
  buildSystemPrompt() {
    return `You are an expert strategic planning advisor for Rural Workforce Agency Victoria (RWAV). You have deep knowledge of:

1. RWAV's strategic transformation from service delivery to systems coordination
2. Rural health workforce challenges in Victoria, Australia
3. Strategic planning best practices for healthcare organisations
4. SWOT analysis methodology
5. Current Australian healthcare legislation and rural health policy

STRATEGIC PLAN CONTEXT:
${JSON.stringify(this.strategicPlanData, null, 2)}

YOUR CAPABILITIES:
- Answer questions about RWAV's strategic plan
- Provide best practice advice for strategic planning decisions
- Research current legal and sector context (when web search is enabled)
- Categorise decisions and content into SWOT framework
- Analyse decision impacts and interdependencies
- Suggest mitigation strategies for risks

SWOT CATEGORISATION GUIDELINES:
- STRENGTHS: Internal positive attributes (e.g., existing trust, established relationships, unique position)
- WEAKNESSES: Internal challenges (e.g., capacity constraints, funding dependency, cultural change resistance)
- OPPORTUNITIES: External positive factors (e.g., stakeholder demand, policy environment, partnership potential)
- THREATS: External risks (e.g., competitive pressure, regulatory changes, funding uncertainty)

COMMUNICATION STYLE:
- Professional but accessible
- Evidence-based (cite strategic plan data and stakeholder feedback)
- Action-oriented (provide specific recommendations)
- Australian English spelling and terminology
- Concise responses (2-3 paragraphs unless detail requested)

IMPORTANT:
- Always ground advice in the strategic plan evidence
- Flag when web search would provide more current information
- Be transparent about assumptions and limitations
- Prioritise Board decision-making needs (clarity, confidence, actionability)`;
  }
  
  /**
   * Send message to chatbot and get response
   */
  async sendMessage(userMessage, options = {}) {
    try {
      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        content: userMessage
      });
      
      // Prepare API request
      const requestBody = {
        model: this.model,
        messages: this.conversationHistory,
        temperature: 0.7,
        max_tokens: 1000
      };
      
      // Add web search if requested
      if (options.webSearch) {
        requestBody.tools = [{
          type: 'function',
          function: {
            name: 'web_search',
            description: 'Search the web for current information about rural health policy, legislation, or sector trends',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query'
                }
              },
              required: ['query']
            }
          }
        }];
      }
      
      // Make API call
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      const assistantMessage = data.choices[0].message.content;
      
      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: assistantMessage
      });
      
      // Check if SWOT categorisation was requested
      if (options.swotAnalysis) {
        await this.updateSWOTMatrix(userMessage, assistantMessage);
      }
      
      return {
        success: true,
        message: assistantMessage,
        swot: options.swotAnalysis ? this.swotMatrix : null
      };
      
    } catch (error) {
      console.error('Chatbot error:', error);
      return {
        success: false,
        error: error.message,
        fallback: this.getOfflineFallback(userMessage)
      };
    }
  }
  
  /**
   * Update SWOT matrix based on conversation
   */
  async updateSWOTMatrix(userMessage, assistantMessage) {
    // Send a follow-up request to categorise the decision/content
    const swotPrompt = `Based on the previous discussion, categorise the following into SWOT framework. Provide a JSON response with categories:

User Input: ${userMessage}
Analysis: ${assistantMessage}

Return JSON format:
{
  "category": "strength|weakness|opportunity|threat",
  "item": "Brief description",
  "rationale": "Why this categorisation"
}`;

    try {
      const swotResponse = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: this.buildSystemPrompt() },
            { role: 'user', content: swotPrompt }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })
      });
      
      const swotData = await swotResponse.json();
      const swotResult = JSON.parse(swotData.choices[0].message.content);
      
      // Add to appropriate SWOT category
      const category = swotResult.category + 's'; // pluralise
      if (this.swotMatrix[category]) {
        this.swotMatrix[category].push({
          item: swotResult.item,
          rationale: swotResult.rationale,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('SWOT categorisation error:', error);
    }
  }
  
  /**
   * Get SWOT matrix
   */
  getSWOTMatrix() {
    return this.swotMatrix;
  }
  
  /**
   * Clear SWOT matrix
   */
  clearSWOTMatrix() {
    this.swotMatrix = {
      strengths: [],
      weaknesses: [],
      opportunities: [],
      threats: []
    };
  }
  
  /**
   * Offline fallback responses for common questions
   */
  getOfflineFallback(userMessage) {
    const fallbacks = {
      'pilot': 'The strategic plan recommends three pilot regions: Bendigo (Inner Regional), Gippsland Lakes (Outer Regional), and Mallee (Remote). Each pilot tests different aspects of the coordination model. Bendigo focuses on data intelligence and university partnerships, Gippsland Lakes on retention strategies, and Mallee on remote service delivery innovation.',
      
      'revenue': 'The financial strategy targets 25-30% non-government revenue by 2030 through four ethical streams: Data Intelligence Services (10-12%), Coordination Administration (8-10%), Strategic Consultation (5-7%), and Innovation Partnerships (2-3%). All revenue streams align with the coordination mission.',
      
      'timeline': 'Implementation follows a 5-year roadmap: Year 1 (2026) - Foundation Building, Year 2 (2027) - Coalition Development, Year 3 (2028) - System Integration, Years 4-5 (2029-2030) - Leadership Consolidation. Pilot programs launch in Year 1.',
      
      'cultural safety': 'Cultural safety is mandatory across all initiatives, requiring ACCHO (Aboriginal Community Controlled Health Organisation) leadership. This addresses First Nations workforce priorities and ensures culturally appropriate service delivery.',
      
      'doers': 'DOERS pillar focuses on frontline impact through strategic partnerships. Key initiatives: Retention Excellence Hubs, Community Map Platform, Cultural Safety Integration, and Rural Health Innovation Partnerships. Success metrics include 15% retention increase and 100% cultural safety compliance.',
      
      'drivers': 'DRIVERS pillar leads systems change and strategic influence. Key initiatives: Rural Health Coalition Leadership, Evidence-Based Policy Advocacy, Multi-Regional Coordination, and Innovation Facilitation. Targets 3 major policy reforms and 5 multi-regional partnerships.',
      
      'enablers': 'ENABLERS pillar builds organisational transformation and sustainability. Key initiatives: Revenue Diversification, Data Intelligence Capability, Partnership Infrastructure, and Cultural Transformation. Aims for 25-30% non-government revenue and 90% stakeholder satisfaction.'
    };
    
    // Find matching fallback
    const messageLower = userMessage.toLowerCase();
    for (const [keyword, response] of Object.entries(fallbacks)) {
      if (messageLower.includes(keyword)) {
        return {
          message: response,
          note: 'This is an offline response. For more detailed or current information, please ensure internet connectivity.'
        };
      }
    }
    
    return {
      message: 'I\'m currently offline. Please check your internet connection for full AI capabilities. In the meantime, you can review the strategic plan content in VERSION 1 of this application.',
      note: 'Offline mode - limited functionality'
    };
  }
  
  /**
   * Clear conversation history (start fresh)
   */
  clearHistory() {
    this.conversationHistory = [];
    this.initialize();
  }
  
  /**
   * Export conversation history
   */
  exportHistory() {
    return {
      conversation: this.conversationHistory,
      swot: this.swotMatrix,
      timestamp: new Date().toISOString()
    };
  }
}

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RWAVChatbot;
}
