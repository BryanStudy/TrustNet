import { verifyAuth, ddbDocClient } from '/opt/nodejs/index.js';
import { PutCommand, QueryCommand, GetCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

// Article validation functions
function validateCreateArticle(data) {
  const errors = [];
  
  if (!data.title || data.title.length < 1) {
    errors.push('Title is required');
  } else if (data.title.length > 200) {
    errors.push('Title too long');
  }
  
  if (!data.content || data.content.length < 1) {
    errors.push('Content is required');
  }
  
  if (!data.category || data.category.length < 1) {
    errors.push('Category is required');
  }
  
  if (!data.readTime || data.readTime < 1) {
    errors.push('Read time must be at least 1 minute');
  }
  
  if (!data.coverImage || data.coverImage.length < 1) {
    errors.push('Cover image is required');
  }
  
  return errors;
}

function validateUpdateArticle(data) {
  const errors = [];
  
  if (data.title !== undefined) {
    if (!data.title || data.title.length < 1) {
      errors.push('Title is required');
    } else if (data.title.length > 200) {
      errors.push('Title too long');
    }
  }
  
  if (data.content !== undefined && (!data.content || data.content.length < 1)) {
    errors.push('Content is required');
  }
  
  if (data.category !== undefined && (!data.category || data.category.length < 1)) {
    errors.push('Category is required');
  }
  
  if (data.readTime !== undefined && data.readTime < 1) {
    errors.push('Read time must be at least 1 minute');
  }
  
  if (data.coverImage !== undefined && (!data.coverImage || data.coverImage.length < 1)) {
    errors.push('Cover image is required');
  }
  
  return errors;
}

// Create article (POST /literacy-hub/create-article)
async function handleCreateArticle(event) {
  try {
    // Check if user is authenticated
    const userPayload = await verifyAuth(event);
    if (!userPayload) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'User is not authenticated' }),
      };
    }

    const body = JSON.parse(event.body || '{}');
    
    const validationErrors = validateCreateArticle(body);
    if (validationErrors.length > 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: validationErrors.join(', ') }),
      };
    }

    // Ensure only the file name is stored for coverImage
    let coverImageFileName = undefined;
    if (body.coverImage) {
      // If it's a URL or path, extract the file name
      const parts = body.coverImage.split('/');
      coverImageFileName = parts[parts.length - 1];
    }

    // Prevent duplicate titles globally using GSI
    const queryCommand = new QueryCommand({
      TableName: 'articles',
      IndexName: 'title-index',
      KeyConditionExpression: 'title = :title',
      ExpressionAttributeValues: { ':title': body.title },
      Limit: 1,
    });
    const { Items } = await ddbDocClient.send(queryCommand);
    if (Items && Items.length > 0) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'An article with this title already exists.' }),
      };
    }

    const articleId = uuidv4();
    const userId = userPayload.userId;
    const createdAt = new Date().toISOString();
    const updatedAt = createdAt;
    const viewable = 'ARTICLES';

    const newArticle = {
      articleId,
      userId,
      createdAt,
      updatedAt,
      viewable,
      ...body,
      coverImage: coverImageFileName,
    };

    const putArticleCommand = new PutCommand({
      TableName: 'articles',
      Item: newArticle,
    });
    await ddbDocClient.send(putArticleCommand);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Article created successfully' }),
    };
  } catch (error) {
    console.error('Error creating article:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Failed to create article' }),
    };
  }
}

// Read all articles (GET /literacy-hub/read-articles)
async function handleReadArticles(event) {
  try {
    const command = new QueryCommand({
      TableName: 'articles',
      IndexName: 'viewable-createdAt-index',
      KeyConditionExpression: 'viewable = :viewable',
      ExpressionAttributeValues: { ':viewable': 'ARTICLES' },
      ScanIndexForward: false, // newest first
    });
    const { Items } = await ddbDocClient.send(command);
    const articles = Items || [];

    // Fetch user info for each article
    const articlesWithAuthor = await Promise.all(
      articles.map(async (article) => {
        let authorName = 'Unknown User';
        let authorPicture = null;
        try {
          const userCommand = new GetCommand({
            TableName: 'users',
            Key: { userId: article.userId },
          });
          const { Item: userItem } = await ddbDocClient.send(userCommand);
          if (userItem && userItem.firstName && userItem.lastName) {
            authorName = `${userItem.firstName} ${userItem.lastName}`;
            authorPicture = userItem.picture || null;
          }
        } catch (userError) {
          // If user fetch fails, keep fallback
        }
        return {
          ...article,
          authorName,
          authorPicture,
        };
      })
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ articles: articlesWithAuthor }),
    };
  } catch (error) {
    console.error('Error fetching articles:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Failed to fetch articles' }),
    };
  }
}

// Read single article (GET /literacy-hub/read-article/{id})
async function handleReadArticle(event) {
  try {
    const articleId = event.pathParameters?.id;

    if (!articleId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'articleId is required.' }),
      };
    }

    // First get the current article
    const articleCommand = new GetCommand({
      TableName: 'articles',
      Key: { articleId },
    });

    const { Item: article } = await ddbDocClient.send(articleCommand);

    if (!article) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Article not found' }),
      };
    }

    // Increment view count
    const updateCommand = new UpdateCommand({
      TableName: 'articles',
      Key: { articleId },
      UpdateExpression: 'SET viewCount = if_not_exists(viewCount, :zero) + :inc',
      ExpressionAttributeValues: {
        ':zero': 0,
        ':inc': 1
      },
      ReturnValues: 'ALL_NEW'
    });

    const { Attributes: updatedArticle } = await ddbDocClient.send(updateCommand);

    if (!updatedArticle) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Failed to update view count' }),
      };
    }

    let authorName = 'Unknown User';
    let authorPicture = null;

    try {
      const userCommand = new GetCommand({
        TableName: 'users',
        Key: { userId: updatedArticle.userId },
      });

      const { Item: userItem } = await ddbDocClient.send(userCommand);

      if (userItem?.firstName && userItem?.lastName) {
        authorName = `${userItem.firstName} ${userItem.lastName}`;
        authorPicture = userItem.picture ?? null;
      }
    } catch {
      // Optional: log this failure
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ article: { ...updatedArticle, authorName, authorPicture } }),
    };
  } catch (error) {
    console.error('Error fetching article:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Failed to fetch article' }),
    };
  }
}

// Update article (PATCH /literacy-hub/update-article/{id})
async function handleUpdateArticle(event) {
  try {
    const articleId = event.pathParameters?.id;
    if (!articleId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Article ID is required' }),
      };
    }

    const body = JSON.parse(event.body || '{}');

    // Validate input using the update schema
    const validationErrors = validateUpdateArticle(body);
    if (validationErrors.length > 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: validationErrors.join(' | ') }),
      };
    }

    // Get the existing article first
    const getCommand = new GetCommand({
      TableName: 'articles',
      Key: { articleId },
    });
    const { Item: existingArticle } = await ddbDocClient.send(getCommand);
    if (!existingArticle) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Article not found' }),
      };
    }

    // Build update expression
    const allowedFields = ['title', 'content', 'category', 'readTime', 'coverImage'];
    const updateFields = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) updateFields[key] = body[key];
    }
    if (Object.keys(updateFields).length === 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'No valid fields to update' }),
      };
    }

    // Build UpdateExpression
    const updateExpr = [];
    const exprAttrNames = {};
    const exprAttrValues = {};
    for (const key of Object.keys(updateFields)) {
      updateExpr.push(`#${key} = :${key}`);
      exprAttrNames[`#${key}`] = key;
      exprAttrValues[`:${key}`] = updateFields[key];
    }
    exprAttrNames['#updatedAt'] = 'updatedAt';
    exprAttrValues[':updatedAt'] = new Date().toISOString();
    updateExpr.push('#updatedAt = :updatedAt');

    const command = new UpdateCommand({
      TableName: 'articles',
      Key: { articleId },
      UpdateExpression: `SET ${updateExpr.join(', ')}`,
      ExpressionAttributeNames: exprAttrNames,
      ExpressionAttributeValues: exprAttrValues,
      ReturnValues: 'ALL_NEW',
    });

    const { Attributes: updated } = await ddbDocClient.send(command);
    if (!updated) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Article not found after update' }),
      };
    }

    // Fetch author info
    let authorName = 'Unknown User';
    let authorPicture = null;
    try {
      const userCommand = new GetCommand({
        TableName: 'users',
        Key: { userId: updated.userId },
      });
      const { Item: userItem } = await ddbDocClient.send(userCommand);
      if (userItem && userItem.firstName && userItem.lastName) {
        authorName = `${userItem.firstName} ${userItem.lastName}`;
        authorPicture = userItem.picture || null;
      }
    } catch {}

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ article: { ...updated, authorName, authorPicture } }),
    };
  } catch (error) {
    console.error('Error updating article:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Failed to update article' }),
    };
  }
}

// Delete article (DELETE /literacy-hub/delete-article/{id})
async function handleDeleteArticle(event) {
  try {
    const articleId = event.pathParameters?.id;
    if (!articleId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Article ID is required' }),
      };
    }

    const command = new DeleteCommand({
      TableName: 'articles',
      Key: { articleId },
    });
    await ddbDocClient.send(command);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Article deleted successfully' }),
    };
  } catch (error) {
    console.error('Error deleting article:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Failed to delete article' }),
    };
  }
}

// Main Lambda handler
export const handler = async (event) => {
  try {
    switch (event.routeKey) {
      case 'POST /literacy-hub/create-article':
        return await handleCreateArticle(event);
      case 'GET /literacy-hub/read-articles':
        return await handleReadArticles(event);
      case 'GET /literacy-hub/read-article/{id}':
        return await handleReadArticle(event);
      case 'PATCH /literacy-hub/update-article/{id}':
        return await handleUpdateArticle(event);
      case 'DELETE /literacy-hub/delete-article/{id}':
        return await handleDeleteArticle(event);
      case 'OPTIONS /literacy-hub/create-article':
      case 'OPTIONS /literacy-hub/read-articles':
      case 'OPTIONS /literacy-hub/read-article/{id}':
      case 'OPTIONS /literacy-hub/update-article/{id}':
      case 'OPTIONS /literacy-hub/delete-article/{id}':
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
          },
          body: JSON.stringify({ message: 'CORS preflight' }),
        };
      default:
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: `Unsupported route: ${event.routeKey}` }),
        };
    }
  } catch (error) {
    console.error('Lambda error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}; 