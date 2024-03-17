const {BigQuery} = require('@google-cloud/bigquery');
const bigquery = new BigQuery();


async function bqGenerate(projectId, datasetId, topic) {
    const query = `
    WITH vector_search AS 
      (SELECT query.query, base.id, base.title, base.content, distance
      FROM
        VECTOR_SEARCH( TABLE \`${projectId}.${datasetId}.arxiv_embeddings\`,
          'ml_generate_embedding_result',
          (
          SELECT
            ml_generate_embedding_result,
            content AS query
          FROM
            ML.GENERATE_EMBEDDING( MODEL \`${projectId}.${datasetId}.embedding_model\`,
              (SELECT @topic AS content)
            )),
          top_k => @topk,
          OPTIONS => '{"fraction_lists_to_search": 0.01}')),

    compose_prompt AS
      (
        SELECT 
          query,
          id,
          title,
          content,
          distance,
          CONCAT(@prompt, content) AS prompt
          FROM vector_search
      )

      SELECT *
    FROM
      ML.GENERATE_TEXT(
        MODEL \`${projectId}.${datasetId}.gemini_model\`,
        (SELECT id, title, prompt FROM compose_prompt),
        STRUCT(
          0.8 AS temperature,
          1024 AS max_output_tokens,
          0.95 AS top_p,
          40 AS top_k));`;

    const options = {
        query: query,
        location: 'EU',
        params: {
            'prompt': 'You are a creative idea person. Using only the context of this prompt (abstract of a research paper), convert the text related to the abstract into a product idea based on what the abstract says. Simplify the wording to be understood by non technical people. Output: Should always be formatted with HTML tags, idea name should be wrapped with <h2> tthen wrap each other section title with an <h3> tag and wrap each paragraph in a <p> tag, no line breaks in the output. Output should contain 3 main sections: name, description and benefits. Abstract context:',
            topk: 5,
            topic: topic
        }
    };

    const [rows] = await bigquery.query(options);
    const suggestions = [];

    rows.forEach((row, i) => {
        const rawResult = row['ml_generate_text_result'];
        const parsedResult = JSON.parse(rawResult);

        const content = parsedResult['candidates'][0].content['parts'][0].text;
        const arxivPaperUrl = `https://arxiv.org/pdf/${row['id']}.pdf`;
        const arxivPaperTitle = row['title'];

        suggestions.push({
            title: `Idea ${i}`,
            content: content,
            arxivPaperUrl: arxivPaperUrl,
            arxivPaperTitle: arxivPaperTitle
        });
    });

    return suggestions;
}

module.exports = {bqGenerate};
